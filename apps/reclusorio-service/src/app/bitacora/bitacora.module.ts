import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  NestInterceptor,
  Query,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import {
  Between,
  DataSource,
  EntitySubscriberInterface,
  FindOptionsWhere,
  InsertEvent,
  LessThan,
  MoreThanOrEqual,
  RemoveEvent,
  Repository,
  UpdateEvent,
} from 'typeorm';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthenticatedUser, RequirePermissions } from '@icms/auth';
import { CORRELATION_ID_KEY, PaginationQueryDto, ipCliente, paginate } from '@icms/common';
import { DatabaseModule } from '@icms/database';
import { Bitacora } from './bitacora.entity';

/** Quién y desde dónde: se fija por petición y lo lee el subscriber de TypeORM. */
interface ContextoBitacora {
  idUsuario: string | null;
  usuario: string | null;
  ip: string | null;
  correlationId: string | null;
  operacion: string;
  /** Último segmento de la ruta si es una acción explícita (confirmar, desactivar...). */
  accionRuta: string | null;
}

const contexto = new AsyncLocalStorage<ContextoBitacora>();

const METODOS_ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ACCIONES_RUTA = new Set(['confirmar', 'descartar', 'desactivar', 'reactivar']);
/** Tablas que no son del dominio: la propia bitácora y el outbox/inbox de mensajería. */
const TABLAS_EXCLUIDAS = new Set(['bitacora', 'outbox_events', 'inbox_events']);

export const ACCIONES_BITACORA = [
  'CREAR',
  'MODIFICAR',
  'QUITAR',
  'CONFIRMAR',
  'DESCARTAR',
  'DESACTIVAR',
  'REACTIVAR',
] as const;

/**
 * Abre el contexto de la bitácora en cada petición que escribe. Corre después
 * de los guards, así que `req.user` ya es el usuario del JWT validado.
 */
@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    if (!METODOS_ESCRITURA.has(req.method)) return next.handle();

    const user = req.user as AuthenticatedUser | undefined;
    // Ruta con sus parámetros como patrón (:id), no con los valores concretos.
    const patron = `${req.baseUrl ?? ''}${(req.route as { path?: string } | undefined)?.path ?? req.path}`;
    const ultimo = patron.split('/').filter(Boolean).pop() ?? '';
    const ctx: ContextoBitacora = {
      idUsuario: user?.id ?? null,
      usuario: user?.username ?? null,
      ip: ipCliente(req) ?? null,
      correlationId: ((req as unknown as Record<string, unknown>)[CORRELATION_ID_KEY] as string) ?? null,
      operacion: `${req.method} ${patron}`.slice(0, 255),
      accionRuta: ACCIONES_RUTA.has(ultimo) ? ultimo.toUpperCase() : null,
    };
    // handle() y subscribe() dentro del contexto: todo el trabajo asíncrono
    // del handler (incluidas las consultas de TypeORM) lo hereda.
    return new Observable((subscriber) =>
      contexto.run(ctx, () => next.handle().subscribe(subscriber)),
    );
  }
}

/** Serializa valores de columna para jsonb (fechas a ISO, buffers fuera). */
function valor(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return `[${v.length} bytes]`;
  return v === undefined ? null : v;
}

/**
 * Registra cada alta/modificación/baja de las tablas del dominio en la MISMA
 * transacción que el cambio: si el cambio se revierte, su bitácora también.
 * Sin contexto de petición (seeders, migraciones) no registra nada.
 */
@Injectable()
export class BitacoraSubscriber implements EntitySubscriberInterface {
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  async afterInsert(event: InsertEvent<Record<string, unknown>>): Promise<void> {
    const despues: Record<string, unknown> = {};
    for (const col of event.metadata.columns) {
      despues[col.propertyName] = valor(col.getEntityValue(event.entity));
    }
    await this.registrar(event, 'CREAR', event.entity, { despues });
  }

  async afterUpdate(event: UpdateEvent<Record<string, unknown>>): Promise<void> {
    if (!event.entity) return;
    const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
    for (const col of event.updatedColumns) {
      cambios[col.propertyName] = {
        antes: valor(event.databaseEntity ? col.getEntityValue(event.databaseEntity) : undefined),
        despues: valor(col.getEntityValue(event.entity as Record<string, unknown>)),
      };
    }
    if (Object.keys(cambios).length === 0) return;
    await this.registrar(event, 'MODIFICAR', event.entity as Record<string, unknown>, cambios);
  }

  async afterRemove(event: RemoveEvent<Record<string, unknown>>): Promise<void> {
    const registro = (event.databaseEntity ?? event.entity) as Record<string, unknown> | undefined;
    if (!registro) return;
    const antes: Record<string, unknown> = {};
    for (const col of event.metadata.columns) antes[col.propertyName] = valor(col.getEntityValue(registro));
    // En un remove la PK ya no viene en la entidad: se toma de entityId.
    const id = event.entityId ? this.formatearId(event.entityId) : null;
    await this.registrar(event, 'QUITAR', registro, { antes }, id);
  }

  private async registrar(
    event: InsertEvent<object> | UpdateEvent<object> | RemoveEvent<object>,
    accionBase: string,
    registro: Record<string, unknown>,
    cambios: Record<string, unknown>,
    idForzado?: string | null,
  ): Promise<void> {
    const ctx = contexto.getStore();
    if (!ctx || TABLAS_EXCLUIDAS.has(event.metadata.tableName)) return;
    const accion = accionBase === 'MODIFICAR' && ctx.accionRuta ? ctx.accionRuta : accionBase;
    const idRegistro =
      idForzado ?? this.formatearId(event.metadata.getEntityIdMap(registro) ?? {});
    // save de una instancia: dispara el @BeforeInsert que asigna idBitacora.
    await event.manager.save(
      Object.assign(new Bitacora(), {
        idUsuario: ctx.idUsuario,
        usuario: ctx.usuario,
        accion,
        entidad: event.metadata.tableName,
        idRegistro: idRegistro.slice(0, 255),
        cambios,
        operacion: ctx.operacion,
        ip: ctx.ip,
        correlationId: ctx.correlationId,
      }),
    );
  }

  private formatearId(id: unknown): string {
    if (id && typeof id === 'object') return Object.values(id).map(String).join('|');
    return String(id ?? '');
  }
}

class BitacoraQuery extends PaginationQueryDto {
  /** Tabla del dominio: personas, incidencias, traslados, centros... */
  @IsOptional() @IsString() @MaxLength(100) entidad?: string;
  @IsOptional() @IsString() @MaxLength(255) idRegistro?: string;
  @IsOptional() @IsUUID() idUsuario?: string;
  @IsOptional() @IsIn(ACCIONES_BITACORA as unknown as string[]) accion?: string;
  /** Rango [desde, hasta) sobre la fecha del cambio. */
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}

@Injectable()
export class BitacoraService {
  constructor(@InjectRepository(Bitacora) private readonly bitacora: Repository<Bitacora>) {}

  async listar(query: BitacoraQuery) {
    const where: FindOptionsWhere<Bitacora> = {
      ...(query.entidad ? { entidad: query.entidad } : {}),
      ...(query.idRegistro ? { idRegistro: query.idRegistro } : {}),
      ...(query.idUsuario ? { idUsuario: query.idUsuario } : {}),
      ...(query.accion ? { accion: query.accion } : {}),
    };
    if (query.desde && query.hasta) {
      where.fecha = Between(new Date(query.desde), new Date(query.hasta));
    } else if (query.desde) {
      where.fecha = MoreThanOrEqual(new Date(query.desde));
    } else if (query.hasta) {
      where.fecha = LessThan(new Date(query.hasta));
    }
    const [items, total] = await this.bitacora.findAndCount({
      where,
      order: { fecha: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(items, total, query);
  }
}

@ApiTags('bitacora')
@ApiBearerAuth()
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly service: BitacoraService) {}

  @Get()
  @RequirePermissions('auditoria:consultar')
  @ApiOperation({
    summary: 'Bitácora del dominio (P5): quién creó, modificó, confirmó o quitó cada registro',
  })
  listar(@Query() query: BitacoraQuery) {
    return this.service.listar(query);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([Bitacora])],
  controllers: [BitacoraController],
  providers: [
    BitacoraService,
    BitacoraSubscriber,
    { provide: APP_INTERCEPTOR, useClass: BitacoraInterceptor },
  ],
})
export class BitacoraModule {}
