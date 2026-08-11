import { Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { BusinessRuleException, EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import { EstadoRevision, marcarRevision } from '../actividades/revision';
import {
  Incidencia,
  IncidenciaAutoridad,
  IncidenciaElemento,
  IncidenciaPersona,
} from '../entities/incidencia.entities';
import { Autoridad, Centro, TipoIncidencia } from '../entities/catalogos-administrables.entities';
import { PersonasModule, PersonasService } from '../personas/personas.module';
import { ElementosModule, ElementosService } from '../elementos/elementos.module';
import { ValidadorCatalogos } from '../actividades/validador-catalogos.service';

class CrearIncidenciaDto {
  @IsUUID() idCentroPenitenciario!: string;
  @IsDateString() fecha!: string;
  @IsUUID() idTipoIncidencia!: string;
  @IsString() @MaxLength(2000) descripcion!: string;
  @IsOptional() @IsString() @MaxLength(100) iph?: string;
  /** RF-INC-007: nombre libre cuando el elemento no está registrado. */
  @IsOptional() @IsString() @MaxLength(255) primerRespondiente?: string;
  @IsOptional() @IsString() narrativa?: string;
}

class AsociarPersonaDto {
  @IsUUID() idPersona!: string;
}

class AsociarAutoridadDto {
  @IsUUID() idAutoridad!: string;
}

class AsociarElementoIncidenciaDto {
  @IsUUID() idElemento!: string;
  /** Marca al elemento registrado como primer respondiente (RF-INC-007). */
  @IsOptional() @IsBoolean() primerRespondiente?: boolean;
}

@Injectable()
export class IncidenciasService {
  constructor(
    @InjectRepository(Incidencia) private readonly repo: Repository<Incidencia>,
    @InjectRepository(IncidenciaPersona) private readonly rePersonas: Repository<IncidenciaPersona>,
    @InjectRepository(IncidenciaAutoridad) private readonly reAutoridades: Repository<IncidenciaAutoridad>,
    @InjectRepository(IncidenciaElemento) private readonly reElementos: Repository<IncidenciaElemento>,
    private readonly personas: PersonasService,
    private readonly elementos: ElementosService,
    private readonly catalogos: ValidadorCatalogos,
  ) {}

  /** RF-INC-001/002: registro INDEPENDIENTE — puede persistir sin personas. */
  async crear(dto: CrearIncidenciaDto) {
    await this.catalogos.asegurarActivo(Centro, 'idCentro', dto.idCentroPenitenciario, 'Centro penitenciario');
    await this.catalogos.asegurarActivo(TipoIncidencia, 'idTipoIncidencia', dto.idTipoIncidencia, 'Tipo de incidencia');
    return this.repo.save(this.repo.create(dto));
  }

  /** RF-INC-009: consulta paginada (DP-010). */
  async listar(query: PaginationQueryDto) {
    const [items, total] = await this.repo.findAndCount({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { fecha: 'DESC' },
    });
    return paginate(items, total, query);
  }

  /** RF-INC-009: detalle con TODAS las asociaciones. */
  async detalle(idIncidencia: string) {
    const incidencia = await this.obtener(idIncidencia);
    const [personas, autoridades, elementos] = await Promise.all([
      this.rePersonas.find({ where: { idIncidencia } }),
      this.reAutoridades.find({ where: { idIncidencia } }),
      this.reElementos.find({ where: { idIncidencia } }),
    ]);
    return {
      ...incidencia,
      personas: personas.map((p) => p.idPersona),
      autoridades: autoridades.map((a) => a.idAutoridad),
      elementos: elementos.map((e) => ({ idElemento: e.idElemento, primerRespondiente: e.primerRespondiente })),
    };
  }

  async obtener(idIncidencia: string): Promise<Incidencia> {
    const incidencia = await this.repo.findOne({ where: { idIncidencia } });
    if (!incidencia) throw new EntityNotFoundException('Incidencia', idIncidencia);
    return incidencia;
  }

  /** RF-INC-003: cero, una o varias personas existentes, sin duplicados. */
  async asociarPersona(idIncidencia: string, idPersona: string) {
    await this.obtener(idIncidencia);
    await this.personas.obtener(idPersona);
    if (await this.rePersonas.findOne({ where: { idIncidencia, idPersona } })) {
      throw new BusinessRuleException('La persona ya está asociada a esta incidencia');
    }
    return this.rePersonas.save(this.rePersonas.create({ idIncidencia, idPersona }));
  }

  /** RF-INC-004: autoridades de apoyo del catálogo. */
  async asociarAutoridad(idIncidencia: string, idAutoridad: string) {
    await this.obtener(idIncidencia);
    await this.catalogos.asegurarActivo(Autoridad, 'idAutoridad', idAutoridad, 'Autoridad');
    if (await this.reAutoridades.findOne({ where: { idIncidencia, idAutoridad } })) {
      throw new BusinessRuleException('La autoridad ya está asociada a esta incidencia');
    }
    return this.reAutoridades.save(this.reAutoridades.create({ idIncidencia, idAutoridad }));
  }

  /** RF-INC-005 + RF-INC-007: elementos participantes; marca al primer respondiente. */
  async asociarElemento(idIncidencia: string, dto: AsociarElementoIncidenciaDto) {
    await this.obtener(idIncidencia);
    await this.elementos.obtener(dto.idElemento);
    if (await this.reElementos.findOne({ where: { idIncidencia, idElemento: dto.idElemento } })) {
      throw new BusinessRuleException('El elemento ya está asociado a esta incidencia');
    }
    return this.reElementos.save(
      this.reElementos.create({
        idIncidencia,
        idElemento: dto.idElemento,
        primerRespondiente: dto.primerRespondiente ?? false,
      }),
    );
  }

  /** Validación inicial P10: confirmar o descartar una única vez. */
  revisar(id: string, estado: EstadoRevision) {
    return marcarRevision(this.repo as never, 'idIncidencia', id, estado, 'Incidencia');
  }
}

@ApiTags('incidencias')
@ApiBearerAuth()
@Controller('incidencias')
export class IncidenciasController {
  constructor(private readonly service: IncidenciasService) {}

  @Get()
  @RequirePermissions('incidencias:consultar')
  @ApiOperation({ summary: 'Consultar incidencias (paginado, RF-INC-009)' })
  listar(@Query() query: PaginationQueryDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissions('incidencias:consultar')
  @ApiOperation({ summary: 'Detalle con personas, autoridades, elementos y archivos asociados' })
  detalle(@Param('id') id: string) {
    return this.service.detalle(id);
  }

  @Post()
  @RequirePermissions('incidencias:crear')
  @ApiOperation({ summary: 'Registrar incidencia independiente — sin personas es válido (RF-INC-001/002)' })
  crear(@Body() dto: CrearIncidenciaDto) {
    return this.service.crear(dto);
  }

  @Post(':id/personas')
  @RequirePermissions('incidencias:asociar')
  @ApiOperation({ summary: 'Asociar persona existente (RF-INC-003)' })
  asociarPersona(@Param('id') id: string, @Body() dto: AsociarPersonaDto) {
    return this.service.asociarPersona(id, dto.idPersona);
  }

  @Post(':id/autoridades')
  @RequirePermissions('incidencias:asociar')
  @ApiOperation({ summary: 'Asociar autoridad de apoyo (RF-INC-004)' })
  asociarAutoridad(@Param('id') id: string, @Body() dto: AsociarAutoridadDto) {
    return this.service.asociarAutoridad(id, dto.idAutoridad);
  }

  @Post(':id/elementos')
  @RequirePermissions('incidencias:asociar')
  @ApiOperation({ summary: 'Asociar elemento; puede marcarse como primer respondiente (RF-INC-005/007)' })
  asociarElemento(@Param('id') id: string, @Body() dto: AsociarElementoIncidenciaDto) {
    return this.service.asociarElemento(id, dto);
  }

  @Post(':id/confirmar')
  @RequirePermissions('incidencias:crear')
  @ApiOperation({ summary: 'Confirmar el registro (validación inicial P10, una sola vez)' })
  confirmar(@Param('id') id: string) {
    return this.service.revisar(id, 'CONFIRMADO');
  }

  @Post(':id/descartar')
  @RequirePermissions('incidencias:crear')
  @ApiOperation({ summary: 'Descartar el registro (validación inicial P10, una sola vez)' })
  descartar(@Param('id') id: string) {
    return this.service.revisar(id, 'DESCARTADO');
  }
}

@Module({
  imports: [
    DatabaseModule.forFeature([Incidencia, IncidenciaPersona, IncidenciaAutoridad, IncidenciaElemento]),
    PersonasModule,
    ElementosModule,
  ],
  controllers: [IncidenciasController],
  providers: [IncidenciasService, ValidadorCatalogos],
})
export class IncidenciasModule {}
