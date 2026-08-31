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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import { Elemento } from '../entities/persona.entities';

class CrearElementoDto {
  @IsOptional() @IsString() @MaxLength(50) grado?: string;
  @IsString() @MaxLength(100) primerNombre!: string;
  @IsString() @MaxLength(100) apellidoPaterno!: string;
  @IsOptional() @IsString() @MaxLength(100) apellidoMaterno?: string;
  /** VARCHAR(50): admite letras y ceros iniciales (RF-ELE-003). */
  @IsOptional() @IsString() @MaxLength(50) numeroElemento?: string;
  @IsOptional() @IsString() @MaxLength(255) adscripcion?: string;
}

class ModificarElementoDto {
  @IsOptional() @IsString() @MaxLength(50) grado?: string;
  @IsOptional() @IsString() @MaxLength(100) primerNombre?: string;
  @IsOptional() @IsString() @MaxLength(100) apellidoPaterno?: string;
  @IsOptional() @IsString() @MaxLength(100) apellidoMaterno?: string;
  @IsOptional() @IsString() @MaxLength(50) numeroElemento?: string;
  @IsOptional() @IsString() @MaxLength(255) adscripcion?: string;
}

/** Parámetros de la búsqueda previa (RF-ELE-001). */
class BusquedaPreviaQuery {
  @IsOptional() @IsString() @MaxLength(50) numeroElemento?: string;
  @IsOptional() @IsString() @MaxLength(200) nombre?: string;
  @IsOptional() @IsString() @MaxLength(255) adscripcion?: string;
}

@Injectable()
export class ElementosService {
  constructor(@InjectRepository(Elemento) private readonly elementos: Repository<Elemento>) {}

  /**
   * Búsqueda previa (RF-ELE-001): primero por numeroElemento; si no hay
   * criterio de número, por nombre completo y adscripción. El flujo de la
   * interfaz presenta estas coincidencias ANTES de habilitar la creación
   * (RF-ELE-002: alta condicionada a confirmación del usuario).
   */
  async buscarCoincidencias(query: BusquedaPreviaQuery): Promise<Elemento[]> {
    if (query.numeroElemento?.trim()) {
      const porNumero = await this.elementos.find({
        where: { numeroElemento: query.numeroElemento.trim() },
      });
      if (porNumero.length > 0) return porNumero;
    }
    if (query.nombre?.trim() || query.adscripcion?.trim()) {
      const qb = this.elementos.createQueryBuilder('e');
      if (query.nombre?.trim()) {
        const texto = `%${query.nombre.trim()}%`;
        qb.andWhere(
          new Brackets((w) =>
            w
              .where("e.primerNombre || ' ' || e.apellidoPaterno || ' ' || COALESCE(e.apellidoMaterno,'') ILIKE :texto", { texto })
              .orWhere('e.primerNombre ILIKE :texto', { texto })
              .orWhere('e.apellidoPaterno ILIKE :texto', { texto }),
          ),
        );
      }
      if (query.adscripcion?.trim()) {
        qb.andWhere('e.adscripcion ILIKE :ads', { ads: `%${query.adscripcion.trim()}%` });
      }
      return qb.take(20).getMany();
    }
    return [];
  }

  /**
   * Adscripciones distintas ya capturadas en el padrón: catálogo DERIVADO para
   * asistir la captura (no existe tabla de adscripciones en el modelo v1.0 y
   * no se inventa; el campo sigue aceptando texto libre).
   */
  async adscripciones(): Promise<string[]> {
    const filas: { adscripcion: string }[] = await this.elementos
      .createQueryBuilder('e')
      .select('DISTINCT e.adscripcion', 'adscripcion')
      .where("e.adscripcion IS NOT NULL AND TRIM(e.adscripcion) <> ''")
      .orderBy('e.adscripcion', 'ASC')
      .getRawMany();
    return filas.map((f) => f.adscripcion);
  }

  /** Listado del módulo administrador de elementos (paginado, DP-010). */
  async listar(query: PaginationQueryDto) {
    const [items, total] = await this.elementos.findAndCount({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { idElemento: 'DESC' },
    });
    return paginate(items, total, query);
  }

  async obtener(idElemento: string): Promise<Elemento> {
    const elemento = await this.elementos.findOne({ where: { idElemento } });
    if (!elemento) throw new EntityNotFoundException('Elemento', idElemento);
    return elemento;
  }

  /** RF-ELE-002/003: creación tras confirmar que no hay coincidencia válida. */
  crear(dto: CrearElementoDto) {
    return this.elementos.save(this.elementos.create(dto));
  }

  async modificar(idElemento: string, dto: ModificarElementoDto) {
    const elemento = await this.obtener(idElemento);
    Object.assign(elemento, dto);
    return this.elementos.save(elemento);
  }

  // NOTA (DP-005): la eliminación de elementos requiere borrado lógico
  // aprobado en el esquema (campo no existente en el modelo actual).
}

@ApiTags('elementos')
@ApiBearerAuth()
@Controller('elementos')
export class ElementosController {
  constructor(private readonly service: ElementosService) {}

  @Get('coincidencias')
  @RequirePermissions('elementos:consultar')
  @ApiOperation({
    summary: 'Búsqueda previa: por numeroElemento y, si no existe, por nombre y adscripción (RF-ELE-001)',
  })
  coincidencias(@Query() query: BusquedaPreviaQuery) {
    return this.service.buscarCoincidencias(query);
  }

  @Get('adscripciones')
  @RequirePermissions('elementos:consultar')
  @ApiOperation({ summary: 'Adscripciones distintas del padrón (catálogo derivado para la captura)' })
  adscripciones() {
    return this.service.adscripciones();
  }

  @Get()
  @RequirePermissions('elementos:consultar')
  @ApiOperation({ summary: 'Listado del padrón de elementos (paginado)' })
  listar(@Query() query: PaginationQueryDto) {
    return this.service.listar(query);
  }

  @Get(':idElemento')
  @RequirePermissions('elementos:consultar')
  @ApiOperation({ summary: 'Detalle de un elemento' })
  obtener(@Param('idElemento') idElemento: string) {
    return this.service.obtener(idElemento);
  }

  @Post()
  @RequirePermissions('elementos:crear')
  @ApiOperation({ summary: 'Alta condicionada: crear solo tras confirmar que no hay coincidencia (RF-ELE-002)' })
  crear(@Body() dto: CrearElementoDto) {
    return this.service.crear(dto);
  }

  @Patch(':idElemento')
  @RequirePermissions('elementos:modificar')
  @ApiOperation({ summary: 'Modificar los datos del elemento' })
  modificar(@Param('idElemento') idElemento: string, @Body() dto: ModificarElementoDto) {
    return this.service.modificar(idElemento, dto);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([Elemento])],
  controllers: [ElementosController],
  providers: [ElementosService],
  exports: [ElementosService],
})
export class ElementosModule {}
