import { Body, Controller, Get, Injectable, Module, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { EntityNotFoundException } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import { IngresoEgreso, Movimiento } from '../entities/actividades.entities';
import { Centro, Delito } from '../entities/catalogos-administrables.entities';
import { MotivoMovimiento, TipoIngresoEgreso, TipoMovimiento } from '../entities/catalogos-fijos.entities';
import { PersonasModule, PersonasService } from '../personas/personas.module';
import { ValidadorCatalogos } from './validador-catalogos.service';
import { NotificadorDominio } from '../notificaciones/notificador-dominio';
import { EstadoRevision, marcarRevision } from './revision';

class CrearIngresoEgresoDto {
  @IsUUID() idTipoIngresoEgreso!: string;
  @IsDateString() fecha!: string;
  @IsUUID() idCentroPenitenciario!: string;
  @IsOptional() @IsString() @MaxLength(255) ubicacion?: string;
  @IsOptional() @IsString() @MaxLength(255) autoridad?: string;
  @IsOptional() @IsUUID() idDelito?: string;
}

class CrearMovimientoDto {
  @IsUUID() idTipoMovimiento!: string;
  @IsDateString() fecha!: string;
  @IsUUID() idCentroOrigen!: string;
  @IsUUID() idCentroDestino!: string;
  @IsOptional() @IsString() @MaxLength(255) ubicacion?: string;
  @IsUUID() idMotivoMovimiento!: string;
}

/** Ingresos y libertades (RF-IEG-001..005). */
@Injectable()
export class IngresosEgresosService {
  constructor(
    @InjectRepository(IngresoEgreso) private readonly repo: Repository<IngresoEgreso>,
    private readonly personas: PersonasService,
    private readonly catalogos: ValidadorCatalogos,
    private readonly notificador: NotificadorDominio,
  ) {}

  /** RF-IEG-001/002/003: se registra desde una persona; catálogos activos por UUID. */
  async crear(idPersona: string, dto: CrearIngresoEgresoDto) {
    await this.personas.obtener(idPersona);
    await this.catalogos.asegurarActivo(TipoIngresoEgreso, 'idTipoIngresoEgreso', dto.idTipoIngresoEgreso, 'Tipo de ingreso/egreso');
    await this.catalogos.asegurarActivo(Centro, 'idCentro', dto.idCentroPenitenciario, 'Centro penitenciario');
    if (dto.idDelito) await this.catalogos.asegurarActivo(Delito, 'idDelito', dto.idDelito, 'Delito');
    const registro = await this.repo.save(this.repo.create({ ...dto, idPersona }));
    this.notificador.difundir(
      'Ingreso/egreso registrado',
      'Se registró un ingreso/egreso en el expediente de una persona.',
      `/personas/${idPersona}`,
    );
    return registro;
  }

  /** RF-IEG-004: historial filtrado por idPersona. */
  async porPersona(idPersona: string) {
    await this.personas.obtener(idPersona);
    return this.repo.find({ where: { idPersona }, order: { fecha: 'DESC' } });
  }

  async obtener(idIngresoEgreso: string) {
    const registro = await this.repo.findOne({ where: { idIngresoEgreso } });
    if (!registro) throw new EntityNotFoundException('Ingreso/egreso', idIngresoEgreso);
    return registro;
  }

  /** Validación inicial P10: confirmar o descartar una única vez. */
  revisar(id: string, estado: EstadoRevision) {
    return marcarRevision(this.repo as never, 'idIngresoEgreso', id, estado, 'Ingreso/egreso');
  }

  /**
   * Población actual por centro (módulo Penitenciarios): una persona está en
   * un centro si su ÚLTIMO registro de ingreso/egreso es de tipo INGRESO; una
   * LIBERTAD posterior la saca del conteo. Devuelve por centro el total y los
   * datos más relevantes de cada persona (la edad SIEMPRE calculada).
   */
  async poblacionPorCentro() {
    const filas: Array<{
      idCentroPenitenciario: string;
      idPersona: string;
      fecha: Date;
      primerNombre?: string;
      apellidoPaterno?: string;
      apellidoMaterno?: string;
      alias?: string;
      curp?: string;
      fechaNacimiento?: string;
      delito?: string;
    }> = await this.repo.query(`
      SELECT u."idCentroPenitenciario", u."idPersona", u.fecha,
             p."primerNombre", p."apellidoPaterno", p."apellidoMaterno",
             p.alias, p.curp, p."fechaNacimiento", d.nombre AS delito
      FROM (
        SELECT DISTINCT ON ("idPersona") *
        FROM ingreso_egreso
        ORDER BY "idPersona", fecha DESC, "idIngresoEgreso" DESC
      ) u
      JOIN tipo_ingreso_egreso t
        ON t."idTipoIngresoEgreso" = u."idTipoIngresoEgreso" AND t.nombre = 'INGRESO'
      JOIN personas p ON p."idPersona" = u."idPersona"
      LEFT JOIN delitos d ON d."idDelito" = u."idDelito"
      ORDER BY u."idCentroPenitenciario", u.fecha DESC
    `);

    const porCentro = new Map<
      string,
      Array<{
        idPersona: string;
        nombre: string;
        alias?: string;
        curp?: string;
        edad: number | null;
        fechaIngreso: Date;
        delito?: string;
      }>
    >();
    for (const f of filas) {
      const lista = porCentro.get(f.idCentroPenitenciario) ?? [];
      lista.push({
        idPersona: f.idPersona,
        nombre: [f.primerNombre, f.apellidoPaterno, f.apellidoMaterno].filter(Boolean).join(' '),
        alias: f.alias ?? undefined,
        curp: f.curp ?? undefined,
        edad: edadDe(f.fechaNacimiento),
        fechaIngreso: f.fecha,
        delito: f.delito ?? undefined,
      });
      porCentro.set(f.idCentroPenitenciario, lista);
    }
    return [...porCentro.entries()].map(([idCentroPenitenciario, personas]) => ({
      idCentroPenitenciario,
      total: personas.length,
      personas,
    }));
  }
}

/** Edad SIEMPRE calculada, nunca persistida (RF-GEN-008). */
function edadDe(fechaNacimiento?: string | Date): number | null {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

/** Movimientos (RF-MOV-001..005). */
@Injectable()
export class MovimientosService {
  constructor(
    @InjectRepository(Movimiento) private readonly repo: Repository<Movimiento>,
    private readonly personas: PersonasService,
    private readonly catalogos: ValidadorCatalogos,
    private readonly notificador: NotificadorDominio,
  ) {}

  async crear(idPersona: string, dto: CrearMovimientoDto) {
    await this.personas.obtener(idPersona);
    await this.catalogos.asegurarActivo(TipoMovimiento, 'idTipoMovimiento', dto.idTipoMovimiento, 'Tipo de movimiento');
    await this.catalogos.asegurarActivo(MotivoMovimiento, 'idMotivoMovimiento', dto.idMotivoMovimiento, 'Motivo de movimiento');
    await this.catalogos.asegurarActivo(Centro, 'idCentro', dto.idCentroOrigen, 'Centro de origen');
    await this.catalogos.asegurarActivo(Centro, 'idCentro', dto.idCentroDestino, 'Centro de destino');
    const registro = await this.repo.save(this.repo.create({ ...dto, idPersona }));
    this.notificador.difundir(
      'Movimiento registrado',
      'Se registró un movimiento entre centros.',
      `/personas/${idPersona}`,
    );
    return registro;
  }

  async porPersona(idPersona: string) {
    await this.personas.obtener(idPersona);
    return this.repo.find({ where: { idPersona }, order: { fecha: 'DESC' } });
  }

  async obtener(idMovimiento: string) {
    const registro = await this.repo.findOne({ where: { idMovimiento } });
    if (!registro) throw new EntityNotFoundException('Movimiento', idMovimiento);
    return registro;
  }

  /** Validación inicial P10: confirmar o descartar una única vez. */
  revisar(id: string, estado: EstadoRevision) {
    return marcarRevision(this.repo as never, 'idMovimiento', id, estado, 'Movimiento');
  }
}

@ApiTags('ingresos-egresos')
@ApiBearerAuth()
@Controller()
export class IngresosEgresosController {
  constructor(private readonly service: IngresosEgresosService) {}

  @Get('personas/:idPersona/ingresos-egresos')
  @RequirePermissions('ingresos:consultar')
  @ApiOperation({ summary: 'Historial de ingresos y libertades de la persona (RF-IEG-004)' })
  porPersona(@Param('idPersona') idPersona: string) {
    return this.service.porPersona(idPersona);
  }

  @Post('personas/:idPersona/ingresos-egresos')
  @RequirePermissions('ingresos:crear')
  @ApiOperation({ summary: 'Registrar ingreso o libertad (RF-IEG-001..003)' })
  crear(@Param('idPersona') idPersona: string, @Body() dto: CrearIngresoEgresoDto) {
    return this.service.crear(idPersona, dto);
  }

  // Declarada ANTES de 'ingresos-egresos/:id' para que la ruta fija gane.
  @Get('ingresos-egresos/poblacion-por-centro')
  @RequirePermissions('personas:consultar')
  @ApiOperation({
    summary: 'Población actual por centro penitenciario (módulo Penitenciarios, P9)',
  })
  poblacionPorCentro() {
    return this.service.poblacionPorCentro();
  }

  @Get('ingresos-egresos/:id')
  @RequirePermissions('ingresos:consultar')
  @ApiOperation({ summary: 'Consultar un ingreso/egreso por id' })
  obtener(@Param('id') id: string) {
    return this.service.obtener(id);
  }

  @Post('ingresos-egresos/:id/confirmar')
  @RequirePermissions('ingresos:crear')
  @ApiOperation({ summary: 'Confirmar el registro (validación inicial P10, una sola vez)' })
  confirmar(@Param('id') id: string) {
    return this.service.revisar(id, 'CONFIRMADO');
  }

  @Post('ingresos-egresos/:id/descartar')
  @RequirePermissions('ingresos:crear')
  @ApiOperation({ summary: 'Descartar el registro (validación inicial P10, una sola vez)' })
  descartar(@Param('id') id: string) {
    return this.service.revisar(id, 'DESCARTADO');
  }
}

@ApiTags('movimientos')
@ApiBearerAuth()
@Controller()
export class MovimientosController {
  constructor(private readonly service: MovimientosService) {}

  @Get('personas/:idPersona/movimientos')
  @RequirePermissions('movimientos:consultar')
  @ApiOperation({ summary: 'Movimientos de la persona (RF-MOV-005)' })
  porPersona(@Param('idPersona') idPersona: string) {
    return this.service.porPersona(idPersona);
  }

  @Post('personas/:idPersona/movimientos')
  @RequirePermissions('movimientos:crear')
  @ApiOperation({ summary: 'Registrar movimiento con origen/destino de catálogo (RF-MOV-001..004)' })
  crear(@Param('idPersona') idPersona: string, @Body() dto: CrearMovimientoDto) {
    return this.service.crear(idPersona, dto);
  }

  @Get('movimientos/:id')
  @RequirePermissions('movimientos:consultar')
  @ApiOperation({ summary: 'Consultar un movimiento por id' })
  obtener(@Param('id') id: string) {
    return this.service.obtener(id);
  }

  @Post('movimientos/:id/confirmar')
  @RequirePermissions('movimientos:crear')
  @ApiOperation({ summary: 'Confirmar el registro (validación inicial P10, una sola vez)' })
  confirmar(@Param('id') id: string) {
    return this.service.revisar(id, 'CONFIRMADO');
  }

  @Post('movimientos/:id/descartar')
  @RequirePermissions('movimientos:crear')
  @ApiOperation({ summary: 'Descartar el registro (validación inicial P10, una sola vez)' })
  descartar(@Param('id') id: string) {
    return this.service.revisar(id, 'DESCARTADO');
  }
}

@Module({
  imports: [DatabaseModule.forFeature([IngresoEgreso, Movimiento]), PersonasModule],
  controllers: [IngresosEgresosController, MovimientosController],
  providers: [IngresosEgresosService, MovimientosService, ValidadorCatalogos],
})
export class IngresosMovimientosModule {}
