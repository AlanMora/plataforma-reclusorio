import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, ObjectType } from 'typeorm';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { DatabaseModule } from '@icms/database';
import { BusinessRuleException, EntityNotFoundException } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import {
  Autoridad,
  CATALOGOS_ADMINISTRABLES,
  Centro,
  Delito,
  DestinoTraslado,
  JuezJuzgado,
  Juzgado,
  TipoAudiencia,
  TipoIncidencia,
} from '../entities/catalogos-administrables.entities';
import {
  CATALOGOS_FIJOS,
  EstatusTraslado,
  FormaIngresoAudiencia,
  ModalidadAudiencia,
  MotivoMovimiento,
  ProximaAudiencia,
  ResolucionAudiencia,
  TipoIngresoEgreso,
  TipoMovimiento,
  TipoTraslado,
} from '../entities/catalogos-fijos.entities';

/** Registro de catálogos ADMINISTRABLES expuestos en el módulo de administración (§16.1). */
const ADMINISTRABLES: Record<string, { entidad: ObjectType<object>; pk: string }> = {
  delitos: { entidad: Delito, pk: 'idDelito' },
  centros: { entidad: Centro, pk: 'idCentro' },
  juzgados: { entidad: Juzgado, pk: 'idJuzgado' },
  juez_juzgados: { entidad: JuezJuzgado, pk: 'idJuezJuzgado' },
  destino_traslado: { entidad: DestinoTraslado, pk: 'idDestinoTraslado' },
  tipo_audiencia: { entidad: TipoAudiencia, pk: 'idTipoAudiencia' },
  tipo_incidencia: { entidad: TipoIncidencia, pk: 'idTipoIncidencia' },
  autoridad: { entidad: Autoridad, pk: 'idAutoridad' },
};

/** Catálogos FIJOS: solo consulta; jamás se editan por interfaz (RF-CAT-008/009). */
const FIJOS: Record<string, { entidad: ObjectType<object>; pk: string }> = {
  tipo_ingreso_egreso: { entidad: TipoIngresoEgreso, pk: 'idTipoIngresoEgreso' },
  tipo_movimientos: { entidad: TipoMovimiento, pk: 'idTipoMovimiento' },
  motivo_movimiento: { entidad: MotivoMovimiento, pk: 'idMotivoMovimiento' },
  forma_ingreso_audiencia: { entidad: FormaIngresoAudiencia, pk: 'idFormaIngresoAudiencia' },
  resolucion_audiencia: { entidad: ResolucionAudiencia, pk: 'idResolucionAudiencia' },
  modalidad_audiencia: { entidad: ModalidadAudiencia, pk: 'idModalidadAudiencia' },
  proxima_audiencia: { entidad: ProximaAudiencia, pk: 'idProximaAudiencia' },
  tipo_traslado: { entidad: TipoTraslado, pk: 'idTipoTraslado' },
  estatus_traslado: { entidad: EstatusTraslado, pk: 'idEstatusTraslado' },
};

class CrearValorDto {
  @IsString() @MaxLength(255) nombre!: string;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
}

class CorregirValorDto {
  @IsOptional() @IsString() @MaxLength(255) nombre?: string;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
}

class ListarQuery {
  /** RF-CAT-001: el administrador consulta activos E inactivos. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  incluirInactivos?: boolean;
}

/** Normalización para dedup (RF-CAT-006): trim + minúsculas + sin acentos. */
function normalizar(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

@Injectable()
export class CatalogosService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private admin(catalogo: string) {
    const def = ADMINISTRABLES[catalogo];
    if (!def) throw new EntityNotFoundException('Catálogo administrable', catalogo);
    return def;
  }

  private fijo(catalogo: string) {
    const def = FIJOS[catalogo];
    if (!def) throw new EntityNotFoundException('Catálogo fijo', catalogo);
    return def;
  }

  /** RF-CAT-001: lista identificando el estado; por defecto solo activos (selectores). */
  listar(catalogo: string, incluirInactivos = false) {
    const { entidad } = this.admin(catalogo);
    const repo = this.dataSource.getRepository(entidad);
    return repo.find({
      where: incluirInactivos ? {} : { activo: true },
      order: { nombre: 'ASC' } as never,
    });
  }

  /** RF-CAT-010: los formularios consumen los fijos por UUID; solo valores activos. */
  listarFijo(catalogo: string) {
    const { entidad } = this.fijo(catalogo);
    return this.dataSource.getRepository(entidad).find({
      where: { activo: true },
      order: { orden: 'ASC' } as never,
    });
  }

  /** RF-CAT-002 + RF-CAT-006: alta con nombre obligatorio y dedup normalizado. */
  async crear(catalogo: string, dto: CrearValorDto) {
    const { entidad } = this.admin(catalogo);
    const repo = this.dataSource.getRepository(entidad);
    await this.rechazarDuplicado(catalogo, dto.nombre);
    return repo.save(repo.create({ nombre: dto.nombre.trim(), descripcion: dto.descripcion, activo: true }));
  }

  /** RF-CAT-003: corrige nombre/descripción conservando el mismo UUID. */
  async corregir(catalogo: string, id: string, dto: CorregirValorDto) {
    const { entidad, pk } = this.admin(catalogo);
    const repo = this.dataSource.getRepository(entidad);
    const valor = (await repo.findOne({ where: { [pk]: id } as never })) as Record<string, unknown> | null;
    if (!valor) throw new EntityNotFoundException('Valor de catálogo', id);
    if (dto.nombre && normalizar(dto.nombre) !== normalizar(valor['nombre'] as string)) {
      await this.rechazarDuplicado(catalogo, dto.nombre);
      valor['nombre'] = dto.nombre.trim();
    }
    if (dto.descripcion !== undefined) valor['descripcion'] = dto.descripcion;
    return repo.save(valor);
  }

  /** RF-CAT-004: nunca eliminación física; el valor deja de ofrecerse en selectores. */
  async desactivar(catalogo: string, id: string) {
    return this.cambiarEstado(catalogo, id, false);
  }

  /** RF-CAT-005: reactivación — vuelve a aparecer en los selectores. */
  async reactivar(catalogo: string, id: string) {
    return this.cambiarEstado(catalogo, id, true);
  }

  private async cambiarEstado(catalogo: string, id: string, activo: boolean) {
    const { entidad, pk } = this.admin(catalogo);
    const repo = this.dataSource.getRepository(entidad);
    const valor = (await repo.findOne({ where: { [pk]: id } as never })) as Record<string, unknown> | null;
    if (!valor) throw new EntityNotFoundException('Valor de catálogo', id);
    valor['activo'] = activo;
    return repo.save(valor);
  }

  /** RF-CAT-006: no se permiten dos valores ACTIVOS equivalentes. */
  private async rechazarDuplicado(catalogo: string, nombre: string): Promise<void> {
    const { entidad } = this.admin(catalogo);
    const activos = (await this.dataSource
      .getRepository(entidad)
      .find({ where: { activo: true } })) as Array<{ nombre: string }>;
    const buscado = normalizar(nombre);
    if (activos.some((v) => normalizar(v.nombre) === buscado)) {
      throw new BusinessRuleException(`Ya existe un valor activo equivalente a "${nombre.trim()}" en ${catalogo}`);
    }
  }
}

@ApiTags('catalogos')
@ApiBearerAuth()
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly service: CatalogosService) {}

  @Get('administrables')
  @ApiOperation({ summary: 'Nombres de los catálogos administrables disponibles' })
  administrables() {
    return Object.keys(ADMINISTRABLES);
  }

  @Get('fijos/:catalogo')
  @ApiParam({ name: 'catalogo', enum: Object.keys(FIJOS) })
  @ApiOperation({ summary: 'Valores activos de un catálogo fijo (consumo por UUID, RF-CAT-010)' })
  listarFijo(@Param('catalogo') catalogo: string) {
    return this.service.listarFijo(catalogo);
  }

  @Get(':catalogo')
  @ApiParam({ name: 'catalogo', enum: Object.keys(ADMINISTRABLES) })
  @ApiOperation({ summary: 'Valores de un catálogo administrable (RF-CAT-001)' })
  listar(@Param('catalogo') catalogo: string, @Query() query: ListarQuery) {
    return this.service.listar(catalogo, query.incluirInactivos ?? false);
  }

  @Post(':catalogo')
  @RequirePermissions('catalogos:administrar')
  @ApiOperation({ summary: 'Agregar un valor (RF-CAT-002, dedup RF-CAT-006)' })
  crear(@Param('catalogo') catalogo: string, @Body() dto: CrearValorDto) {
    return this.service.crear(catalogo, dto);
  }

  @Patch(':catalogo/:id')
  @RequirePermissions('catalogos:administrar')
  @ApiOperation({ summary: 'Corregir nombre/descripción conservando el UUID (RF-CAT-003)' })
  corregir(@Param('catalogo') catalogo: string, @Param('id') id: string, @Body() dto: CorregirValorDto) {
    return this.service.corregir(catalogo, id, dto);
  }

  @Post(':catalogo/:id/desactivar')
  @RequirePermissions('catalogos:administrar')
  @ApiOperation({ summary: 'Desactivar sin eliminar físicamente (RF-CAT-004)' })
  desactivar(@Param('catalogo') catalogo: string, @Param('id') id: string) {
    return this.service.desactivar(catalogo, id);
  }

  @Post(':catalogo/:id/reactivar')
  @RequirePermissions('catalogos:administrar')
  @ApiOperation({ summary: 'Reactivar un valor desactivado (RF-CAT-005)' })
  reactivar(@Param('catalogo') catalogo: string, @Param('id') id: string) {
    return this.service.reactivar(catalogo, id);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([...CATALOGOS_ADMINISTRABLES, ...CATALOGOS_FIJOS])],
  controllers: [CatalogosController],
  providers: [CatalogosService],
  exports: [CatalogosService],
})
export class CatalogosModule {}
