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
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import { Idempotent } from '@icms/redis';
import { Domicilio, Persona } from '../entities/persona.entities';

/**
 * DTO de alta (RF-PER-003). Obligatoriedad según DP-007: primerNombre, curp
 * y fechaNacimiento son obligatorios EN LA VALIDACIÓN (el esquema los deja
 * opcionales por fidelidad al modelo — pendiente P1 del plan).
 */
class CrearPersonaDto {
  @IsString() @MaxLength(150) primerNombre!: string;
  @IsOptional() @IsString() @MaxLength(150) apellidoPaterno?: string;
  @IsOptional() @IsString() @MaxLength(150) apellidoMaterno?: string;
  @IsDateString() fechaNacimiento!: string;
  @IsOptional() @IsString() @MaxLength(150) alias?: string;
  @IsString()
  @Length(18, 18)
  @Matches(/^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/i, {
    message: 'curp no tiene el formato oficial de 18 caracteres',
  })
  curp!: string;
  @IsOptional() @IsString() @MaxLength(50) genero?: string;
  @IsOptional() @IsString() @MaxLength(50) estadoCivil?: string;
  @IsOptional() @IsString() @MaxLength(50) nivelEducativo?: string;
  @IsOptional() @IsString() @MaxLength(50) ocupacion?: string;
  @IsOptional() @IsString() @MaxLength(255) nacionalidad?: string;
  @IsOptional() @IsString() @MaxLength(255) estadoNacimiento?: string;
  @IsOptional() @IsString() @MaxLength(50) numeroTelefono?: string;
}

/** Modificación (RF-PER-005): todos los campos opcionales, mismos tipos/longitudes. */
class ModificarPersonaDto {
  @IsOptional() @IsString() @MaxLength(150) primerNombre?: string;
  @IsOptional() @IsString() @MaxLength(150) apellidoPaterno?: string;
  @IsOptional() @IsString() @MaxLength(150) apellidoMaterno?: string;
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsString() @MaxLength(150) alias?: string;
  @IsOptional()
  @IsString()
  @Length(18, 18)
  @Matches(/^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/i, {
    message: 'curp no tiene el formato oficial de 18 caracteres',
  })
  curp?: string;
  @IsOptional() @IsString() @MaxLength(50) genero?: string;
  @IsOptional() @IsString() @MaxLength(50) estadoCivil?: string;
  @IsOptional() @IsString() @MaxLength(50) nivelEducativo?: string;
  @IsOptional() @IsString() @MaxLength(50) ocupacion?: string;
  @IsOptional() @IsString() @MaxLength(255) nacionalidad?: string;
  @IsOptional() @IsString() @MaxLength(255) estadoNacimiento?: string;
  @IsOptional() @IsString() @MaxLength(50) numeroTelefono?: string;
}

/** Búsqueda (RF-PER-002): como mínimo por nombre, apellidos, alias y CURP. */
class BuscarPersonasQuery extends PaginationQueryDto {
  /** Texto libre que se compara contra nombre, apellidos y alias. */
  @IsOptional() @IsString() @MaxLength(150) buscar?: string;
  /** Coincidencia exacta (insensible a mayúsculas) de CURP. */
  @IsOptional() @IsString() @MaxLength(18) curp?: string;
}

class CrearDomicilioDto {
  @IsString() @MaxLength(150) calle!: string;
  @IsOptional() @IsString() @MaxLength(30) numeroExterior?: string;
  @IsOptional() @IsString() @MaxLength(30) numeroInterior?: string;
  @IsOptional() @IsString() @MaxLength(150) cruce1?: string;
  @IsOptional() @IsString() @MaxLength(150) cruce2?: string;
  @IsOptional() @IsString() @MaxLength(150) colonia?: string;
  @IsOptional() @IsString() @MaxLength(150) estado?: string;
  @IsOptional() @IsString() @MaxLength(150) municipio?: string;
  @IsOptional() @IsString() @MaxLength(150) pais?: string;
  /** Coordenadas capturadas desde el mapa (desviación aprobada 2026-08-11). */
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitud?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitud?: number;
}

/** Serializa la persona incluyendo la edad calculada (RF-GEN-008). */
function conEdad(persona: Persona) {
  return { ...persona, edad: persona.edad };
}

@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(Persona) private readonly personas: Repository<Persona>,
    @InjectRepository(Domicilio) private readonly domicilios: Repository<Domicilio>,
  ) {}

  /** RF-PER-001/002: listado con búsqueda por nombre, apellidos, alias y CURP; paginado (DP-010). */
  async buscar(query: BuscarPersonasQuery) {
    const qb = this.personas.createQueryBuilder('p');
    if (query.curp) {
      qb.andWhere('UPPER(p.curp) = UPPER(:curp)', { curp: query.curp.trim() });
    }
    if (query.buscar) {
      const texto = `%${query.buscar.trim()}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('p.primerNombre ILIKE :texto', { texto })
            .orWhere('p.apellidoPaterno ILIKE :texto', { texto })
            .orWhere('p.apellidoMaterno ILIKE :texto', { texto })
            .orWhere('p.alias ILIKE :texto', { texto }),
        ),
      );
    }
    qb.orderBy('p.idPersona', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items.map(conEdad), total, query);
  }

  /** RF-PER-003: alta con idPersona UUID; la edad nunca se persiste. */
  crear(dto: CrearPersonaDto) {
    return this.personas
      .save(this.personas.create({ ...dto, curp: dto.curp.toUpperCase() }))
      .then(conEdad);
  }

  /** RF-PER-004: detalle con domicilios; las secciones operativas se consultan en sus módulos. */
  async detalle(idPersona: string) {
    const persona = await this.obtener(idPersona);
    const domicilios = await this.domicilios.find({ where: { idPersona } });
    return { ...conEdad(persona), domicilios };
  }

  async obtener(idPersona: string): Promise<Persona> {
    const persona = await this.personas.findOne({ where: { idPersona } });
    if (!persona) throw new EntityNotFoundException('Persona', idPersona);
    return persona;
  }

  /** RF-PER-005: modificación respetando tipos y longitudes del modelo. */
  async modificar(idPersona: string, dto: ModificarPersonaDto) {
    const persona = await this.obtener(idPersona);
    Object.assign(persona, dto, dto.curp ? { curp: dto.curp.toUpperCase() } : {});
    return this.personas.save(persona).then(conEdad);
  }

  // NOTA (pendiente P4/DP-005): NO existe baja de personas. El modelo no
  // define campo de estado y la regla exacta está bloqueada; no se inventa.

  /** RF-PER-006/007: domicilios múltiples por persona. */
  async agregarDomicilio(idPersona: string, dto: CrearDomicilioDto) {
    await this.obtener(idPersona); // la FK exige persona existente
    return this.domicilios.save(this.domicilios.create({ ...dto, idPersona }));
  }

  async listarDomicilios(idPersona: string) {
    await this.obtener(idPersona);
    return this.domicilios.find({ where: { idPersona } });
  }
}

@ApiTags('personas')
@ApiBearerAuth()
@Controller('personas')
export class PersonasController {
  constructor(private readonly service: PersonasService) {}

  @Get()
  @RequirePermissions('personas:consultar')
  @ApiOperation({ summary: 'Buscar personas por nombre, apellidos, alias o CURP (paginado)' })
  buscar(@Query() query: BuscarPersonasQuery) {
    return this.service.buscar(query);
  }

  @Get(':idPersona')
  @RequirePermissions('personas:consultar')
  @ApiOperation({ summary: 'Detalle de la persona con edad calculada y domicilios' })
  detalle(@Param('idPersona') idPersona: string) {
    return this.service.detalle(idPersona);
  }

  @Post()
  @RequirePermissions('personas:crear')
  @Idempotent()
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clave de idempotencia (UUID)' })
  @ApiOperation({ summary: 'Alta de persona (DP-007: nombre, CURP y fecha de nacimiento obligatorios)' })
  crear(@Body() dto: CrearPersonaDto) {
    return this.service.crear(dto);
  }

  @Patch(':idPersona')
  @RequirePermissions('personas:modificar')
  @ApiOperation({ summary: 'Modificar datos de la persona (RF-PER-005)' })
  modificar(@Param('idPersona') idPersona: string, @Body() dto: ModificarPersonaDto) {
    return this.service.modificar(idPersona, dto);
  }

  @Get(':idPersona/domicilios')
  @RequirePermissions('personas:consultar')
  @ApiOperation({ summary: 'Domicilios de la persona (RF-PER-006)' })
  domicilios(@Param('idPersona') idPersona: string) {
    return this.service.listarDomicilios(idPersona);
  }

  @Post(':idPersona/domicilios')
  @RequirePermissions('personas:modificar')
  @ApiOperation({ summary: 'Agregar un domicilio (RF-PER-007: números alfanuméricos como 12-A o S/N)' })
  agregarDomicilio(@Param('idPersona') idPersona: string, @Body() dto: CrearDomicilioDto) {
    return this.service.agregarDomicilio(idPersona, dto);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([Persona, Domicilio])],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService],
})
export class PersonasModule {}
