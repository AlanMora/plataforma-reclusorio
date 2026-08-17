import { Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { BusinessRuleException, EntityNotFoundException } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import {
  Audiencia,
  AudienciaElemento,
  Traslado,
  TrasladoElemento,
} from '../entities/actividades.entities';
import { DestinoTraslado, JuezJuzgado, Juzgado, TipoAudiencia } from '../entities/catalogos-administrables.entities';
import {
  EstatusTraslado,
  FormaIngresoAudiencia,
  ModalidadAudiencia,
  ProximaAudiencia,
  ResolucionAudiencia,
  TipoTraslado,
} from '../entities/catalogos-fijos.entities';
import { PersonasModule, PersonasService } from '../personas/personas.module';
import { ElementosModule, ElementosService } from '../elementos/elementos.module';
import { ValidadorCatalogos } from './validador-catalogos.service';
import { NotificadorDominio } from '../notificaciones/notificador-dominio';
import { EstadoRevision, marcarRevision } from './revision';

class CrearAudienciaDto {
  @IsDateString() fecha!: string;
  @IsOptional() @IsString() @MaxLength(100) ca?: string;
  @IsOptional() @IsString() @MaxLength(100) ci?: string;
  @IsUUID() idFormaIngresoAudiencia!: string;
  @IsUUID() idJuzgado!: string;
  @IsUUID() idJuezJuzgado!: string;
  @IsOptional() @IsString() @MaxLength(255) nombreJuez?: string;
  @IsUUID() idTipoAudiencia!: string;
  @IsUUID() idModalidadAudiencia!: string;
  @IsOptional() @IsUUID() idResolucionAudiencia?: string;
  @IsOptional() @IsString() @MaxLength(2000) observaciones?: string;
  @IsUUID() idProximaAudiencia!: string;
  @IsOptional() @IsDateString() fechaSiguienteAudiencia?: string;
}

class CrearTrasladoDto {
  @IsDateString() fecha!: string;
  @IsUUID() idTipoTraslado!: string;
  @IsUUID() idDestinoTraslado!: string;
  @IsOptional() @IsString() @MaxLength(2000) descripcion?: string;
  @IsOptional() @IsString() @MaxLength(255) unidades?: string;
  @IsOptional() @IsString() @MaxLength(2000) observaciones?: string;
  @IsUUID() idEstatusTraslado!: string;
}

class AsociarElementoDto {
  @IsUUID() idElemento!: string;
}

/** Rango opcional para los traslados del mapa (P11). */
class TrasladosMapaQuery {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}

/** Audiencias (RF-AUD-001..008). */
@Injectable()
export class AudienciasService {
  constructor(
    @InjectRepository(Audiencia) private readonly repo: Repository<Audiencia>,
    @InjectRepository(AudienciaElemento) private readonly asociaciones: Repository<AudienciaElemento>,
    private readonly personas: PersonasService,
    private readonly elementos: ElementosService,
    private readonly catalogos: ValidadorCatalogos,
    private readonly notificador: NotificadorDominio,
  ) {}

  async crear(idPersona: string, dto: CrearAudienciaDto) {
    await this.personas.obtener(idPersona);
    await this.catalogos.asegurarActivo(FormaIngresoAudiencia, 'idFormaIngresoAudiencia', dto.idFormaIngresoAudiencia, 'Forma de ingreso');
    await this.catalogos.asegurarActivo(Juzgado, 'idJuzgado', dto.idJuzgado, 'Juzgado');
    await this.catalogos.asegurarActivo(JuezJuzgado, 'idJuezJuzgado', dto.idJuezJuzgado, 'Juez/juzgado');
    await this.catalogos.asegurarActivo(TipoAudiencia, 'idTipoAudiencia', dto.idTipoAudiencia, 'Tipo de audiencia');
    await this.catalogos.asegurarActivo(ModalidadAudiencia, 'idModalidadAudiencia', dto.idModalidadAudiencia, 'Modalidad');
    if (dto.idResolucionAudiencia) {
      await this.catalogos.asegurarActivo(ResolucionAudiencia, 'idResolucionAudiencia', dto.idResolucionAudiencia, 'Resolución');
    }
    // RF-AUD-004 (§8 del modelo): coherencia entre proxima_audiencia y la fecha.
    const proxima = await this.catalogos.asegurarActivo(ProximaAudiencia, 'idProximaAudiencia', dto.idProximaAudiencia, 'Próxima audiencia');
    if (proxima.nombre === 'NO' && dto.fechaSiguienteAudiencia) {
      throw new BusinessRuleException('fechaSiguienteAudiencia debe permanecer vacía cuando próxima audiencia es NO');
    }
    const registro = await this.repo.save(this.repo.create({ ...dto, idPersona }));
    this.notificador.difundir(
      'Audiencia registrada',
      'Se registró una audiencia en el expediente de una persona.',
      `/personas/${idPersona}`,
    );
    return registro;
  }

  async porPersona(idPersona: string) {
    await this.personas.obtener(idPersona);
    return this.repo.find({ where: { idPersona }, order: { fecha: 'DESC' } });
  }

  async obtener(idAudiencia: string) {
    const audiencia = await this.repo.findOne({ where: { idAudiencia } });
    if (!audiencia) throw new EntityNotFoundException('Audiencia', idAudiencia);
    const elementos = await this.asociaciones.find({ where: { idAudiencia } });
    return { ...audiencia, elementos: elementos.map((e) => e.idElemento) };
  }

  /** RF-AUD-006 + RF-ELE-004/005: asocia elementos reutilizables sin duplicar. */
  async asociarElemento(idAudiencia: string, idElemento: string) {
    await this.obtener(idAudiencia);
    await this.elementos.obtener(idElemento);
    const existente = await this.asociaciones.findOne({ where: { idAudiencia, idElemento } });
    if (existente) throw new BusinessRuleException('El elemento ya está asociado a esta audiencia');
    return this.asociaciones.save(this.asociaciones.create({ idAudiencia, idElemento }));
  }

  /** Validación inicial P10: confirmar o descartar una única vez. */
  revisar(id: string, estado: EstadoRevision) {
    return marcarRevision(this.repo as never, 'idAudiencia', id, estado, 'Audiencia');
  }
}

/** Traslados (RF-TRA-001..007). */
@Injectable()
export class TrasladosService {
  constructor(
    @InjectRepository(Traslado) private readonly repo: Repository<Traslado>,
    @InjectRepository(TrasladoElemento) private readonly asociaciones: Repository<TrasladoElemento>,
    private readonly personas: PersonasService,
    private readonly elementos: ElementosService,
    private readonly catalogos: ValidadorCatalogos,
    private readonly notificador: NotificadorDominio,
  ) {}

  async crear(idPersona: string, dto: CrearTrasladoDto) {
    await this.personas.obtener(idPersona);
    await this.catalogos.asegurarActivo(TipoTraslado, 'idTipoTraslado', dto.idTipoTraslado, 'Tipo de traslado');
    await this.catalogos.asegurarActivo(DestinoTraslado, 'idDestinoTraslado', dto.idDestinoTraslado, 'Destino de traslado');
    await this.catalogos.asegurarActivo(EstatusTraslado, 'idEstatusTraslado', dto.idEstatusTraslado, 'Estatus de traslado');
    const registro = await this.repo.save(this.repo.create({ ...dto, idPersona }));
    this.notificador.difundir(
      'Traslado registrado',
      'Se registró un traslado en el expediente de una persona.',
      `/personas/${idPersona}`,
    );
    return registro;
  }

  async porPersona(idPersona: string) {
    await this.personas.obtener(idPersona);
    return this.repo.find({ where: { idPersona }, order: { fecha: 'DESC' } });
  }

  /**
   * Traslados recientes con la persona y su centro de ORIGEN (centro del
   * último INGRESO) para dibujarlos en el mapa Penitenciarios (P11).
   * Los DESCARTADOS (P10) no se muestran.
   */
  async paraMapa(query: TrasladosMapaQuery) {
    const condiciones = [`t."estadoRevision" <> 'DESCARTADO'`];
    const parametros: string[] = [];
    if (query.desde) {
      parametros.push(query.desde);
      condiciones.push(`t.fecha >= $${parametros.length}`);
    }
    if (query.hasta) {
      parametros.push(query.hasta);
      condiciones.push(`t.fecha <= $${parametros.length}`);
    }
    const filas: Array<{
      idTraslado: string;
      fecha: Date;
      idPersona: string;
      idTipoTraslado: string;
      idDestinoTraslado: string;
      idEstatusTraslado: string;
      unidades?: string;
      descripcion?: string;
      observaciones?: string;
      estadoRevision: string;
      primerNombre?: string;
      apellidoPaterno?: string;
      apellidoMaterno?: string;
      alias?: string;
      idCentroOrigen?: string;
    }> = await this.repo.query(
      `
      SELECT t."idTraslado", t.fecha, t."idPersona", t."idTipoTraslado", t."idDestinoTraslado",
             t."idEstatusTraslado", t.unidades, t.descripcion, t.observaciones, t."estadoRevision",
             p."primerNombre", p."apellidoPaterno", p."apellidoMaterno", p.alias,
             u."idCentroPenitenciario" AS "idCentroOrigen"
      FROM traslados t
      JOIN personas p ON p."idPersona" = t."idPersona"
      LEFT JOIN (
        SELECT DISTINCT ON (ie."idPersona") ie."idPersona", ie."idCentroPenitenciario", ie."idTipoIngresoEgreso"
        FROM ingreso_egreso ie
        ORDER BY ie."idPersona", ie.fecha DESC, ie."idIngresoEgreso" DESC
      ) u ON u."idPersona" = t."idPersona"
         AND u."idTipoIngresoEgreso" IN (
           SELECT "idTipoIngresoEgreso" FROM tipo_ingreso_egreso WHERE nombre = 'INGRESO'
         )
      WHERE ${condiciones.join(' AND ')}
      ORDER BY t.fecha DESC
      LIMIT 100
      `,
      parametros,
    );
    return filas.map((f) => ({
      idTraslado: f.idTraslado,
      fecha: f.fecha,
      idPersona: f.idPersona,
      nombrePersona: [f.primerNombre, f.apellidoPaterno, f.apellidoMaterno]
        .filter(Boolean)
        .join(' '),
      alias: f.alias ?? undefined,
      idTipoTraslado: f.idTipoTraslado,
      idDestinoTraslado: f.idDestinoTraslado,
      idEstatusTraslado: f.idEstatusTraslado,
      unidades: f.unidades ?? undefined,
      descripcion: f.descripcion ?? undefined,
      observaciones: f.observaciones ?? undefined,
      estadoRevision: f.estadoRevision,
      idCentroOrigen: f.idCentroOrigen ?? undefined,
    }));
  }

  async obtener(idTraslado: string) {
    const traslado = await this.repo.findOne({ where: { idTraslado } });
    if (!traslado) throw new EntityNotFoundException('Traslado', idTraslado);
    const elementos = await this.asociaciones.find({ where: { idTraslado } });
    return { ...traslado, elementos: elementos.map((e) => e.idElemento) };
  }

  /** RF-TRA-006: cero o múltiples elementos, sin duplicados. */
  async asociarElemento(idTraslado: string, idElemento: string) {
    await this.obtener(idTraslado);
    await this.elementos.obtener(idElemento);
    const existente = await this.asociaciones.findOne({ where: { idTraslado, idElemento } });
    if (existente) throw new BusinessRuleException('El elemento ya está asociado a este traslado');
    return this.asociaciones.save(this.asociaciones.create({ idTraslado, idElemento }));
  }

  /** Validación inicial P10: confirmar o descartar una única vez. */
  revisar(id: string, estado: EstadoRevision) {
    return marcarRevision(this.repo as never, 'idTraslado', id, estado, 'Traslado');
  }
}

@ApiTags('audiencias')
@ApiBearerAuth()
@Controller()
export class AudienciasController {
  constructor(private readonly service: AudienciasService) {}

  @Get('personas/:idPersona/audiencias')
  @RequirePermissions('audiencias:consultar')
  @ApiOperation({ summary: 'Audiencias de la persona (RF-AUD-008)' })
  porPersona(@Param('idPersona') idPersona: string) {
    return this.service.porPersona(idPersona);
  }

  @Post('personas/:idPersona/audiencias')
  @RequirePermissions('audiencias:crear')
  @ApiOperation({ summary: 'Registrar audiencia con datos jurídicos y clasificación (RF-AUD-001..005)' })
  crear(@Param('idPersona') idPersona: string, @Body() dto: CrearAudienciaDto) {
    return this.service.crear(idPersona, dto);
  }

  @Get('audiencias/:id')
  @RequirePermissions('audiencias:consultar')
  @ApiOperation({ summary: 'Detalle de la audiencia con sus elementos' })
  obtener(@Param('id') id: string) {
    return this.service.obtener(id);
  }

  @Post('audiencias/:id/elementos')
  @RequirePermissions('audiencias:asociar')
  @ApiOperation({ summary: 'Asociar un elemento participante (RF-AUD-006, sin duplicados)' })
  asociar(@Param('id') id: string, @Body() dto: AsociarElementoDto) {
    return this.service.asociarElemento(id, dto.idElemento);
  }

  @Post('audiencias/:id/confirmar')
  @RequirePermissions('audiencias:crear')
  @ApiOperation({ summary: 'Confirmar el registro (validación inicial P10, una sola vez)' })
  confirmar(@Param('id') id: string) {
    return this.service.revisar(id, 'CONFIRMADO');
  }

  @Post('audiencias/:id/descartar')
  @RequirePermissions('audiencias:crear')
  @ApiOperation({ summary: 'Descartar el registro (validación inicial P10, una sola vez)' })
  descartar(@Param('id') id: string) {
    return this.service.revisar(id, 'DESCARTADO');
  }
}

@ApiTags('traslados')
@ApiBearerAuth()
@Controller()
export class TrasladosController {
  constructor(private readonly service: TrasladosService) {}

  @Get('personas/:idPersona/traslados')
  @RequirePermissions('traslados:consultar')
  @ApiOperation({ summary: 'Traslados de la persona (RF-TRA-007)' })
  porPersona(@Param('idPersona') idPersona: string) {
    return this.service.porPersona(idPersona);
  }

  @Post('personas/:idPersona/traslados')
  @RequirePermissions('traslados:crear')
  @ApiOperation({ summary: 'Registrar traslado con tipo, destino y estatus de catálogo (RF-TRA-001..005)' })
  crear(@Param('idPersona') idPersona: string, @Body() dto: CrearTrasladoDto) {
    return this.service.crear(idPersona, dto);
  }

  @Get('traslados/mapa')
  @RequirePermissions('traslados:consultar')
  @ApiOperation({
    summary: 'Traslados recientes con persona y centro de origen para el mapa (P11)',
  })
  paraMapa(@Query() query: TrasladosMapaQuery) {
    return this.service.paraMapa(query);
  }

  @Get('traslados/:id')
  @RequirePermissions('traslados:consultar')
  @ApiOperation({ summary: 'Detalle del traslado con sus elementos' })
  obtener(@Param('id') id: string) {
    return this.service.obtener(id);
  }

  @Post('traslados/:id/elementos')
  @RequirePermissions('traslados:asociar')
  @ApiOperation({ summary: 'Asociar un elemento participante (RF-TRA-006, sin duplicados)' })
  asociar(@Param('id') id: string, @Body() dto: AsociarElementoDto) {
    return this.service.asociarElemento(id, dto.idElemento);
  }

  @Post('traslados/:id/confirmar')
  @RequirePermissions('traslados:crear')
  @ApiOperation({ summary: 'Confirmar el registro (validación inicial P10, una sola vez)' })
  confirmar(@Param('id') id: string) {
    return this.service.revisar(id, 'CONFIRMADO');
  }

  @Post('traslados/:id/descartar')
  @RequirePermissions('traslados:crear')
  @ApiOperation({ summary: 'Descartar el registro (validación inicial P10, una sola vez)' })
  descartar(@Param('id') id: string) {
    return this.service.revisar(id, 'DESCARTADO');
  }
}

@Module({
  imports: [
    DatabaseModule.forFeature([Audiencia, AudienciaElemento, Traslado, TrasladoElemento]),
    PersonasModule,
    ElementosModule,
  ],
  controllers: [AudienciasController, TrasladosController],
  providers: [AudienciasService, TrasladosService, ValidadorCatalogos],
})
export class AudienciasTrasladosModule {}
