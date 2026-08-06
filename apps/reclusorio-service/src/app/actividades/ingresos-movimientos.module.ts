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
  ) {}

  /** RF-IEG-001/002/003: se registra desde una persona; catálogos activos por UUID. */
  async crear(idPersona: string, dto: CrearIngresoEgresoDto) {
    await this.personas.obtener(idPersona);
    await this.catalogos.asegurarActivo(TipoIngresoEgreso, 'idTipoIngresoEgreso', dto.idTipoIngresoEgreso, 'Tipo de ingreso/egreso');
    await this.catalogos.asegurarActivo(Centro, 'idCentro', dto.idCentroPenitenciario, 'Centro penitenciario');
    if (dto.idDelito) await this.catalogos.asegurarActivo(Delito, 'idDelito', dto.idDelito, 'Delito');
    return this.repo.save(this.repo.create({ ...dto, idPersona }));
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
}

/** Movimientos (RF-MOV-001..005). */
@Injectable()
export class MovimientosService {
  constructor(
    @InjectRepository(Movimiento) private readonly repo: Repository<Movimiento>,
    private readonly personas: PersonasService,
    private readonly catalogos: ValidadorCatalogos,
  ) {}

  async crear(idPersona: string, dto: CrearMovimientoDto) {
    await this.personas.obtener(idPersona);
    await this.catalogos.asegurarActivo(TipoMovimiento, 'idTipoMovimiento', dto.idTipoMovimiento, 'Tipo de movimiento');
    await this.catalogos.asegurarActivo(MotivoMovimiento, 'idMotivoMovimiento', dto.idMotivoMovimiento, 'Motivo de movimiento');
    await this.catalogos.asegurarActivo(Centro, 'idCentro', dto.idCentroOrigen, 'Centro de origen');
    await this.catalogos.asegurarActivo(Centro, 'idCentro', dto.idCentroDestino, 'Centro de destino');
    return this.repo.save(this.repo.create({ ...dto, idPersona }));
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

  @Get('ingresos-egresos/:id')
  @RequirePermissions('ingresos:consultar')
  @ApiOperation({ summary: 'Consultar un ingreso/egreso por id' })
  obtener(@Param('id') id: string) {
    return this.service.obtener(id);
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
}

@Module({
  imports: [DatabaseModule.forFeature([IngresoEgreso, Movimiento]), PersonasModule],
  controllers: [IngresosEgresosController, MovimientosController],
  providers: [IngresosEgresosService, MovimientosService, ValidadorCatalogos],
})
export class IngresosMovimientosModule {}
