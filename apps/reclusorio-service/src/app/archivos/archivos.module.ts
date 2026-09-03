import {
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v7 as uuidv7 } from 'uuid';
import { DatabaseModule } from '@icms/database';
import { parseBoolean } from '@icms/config';
import { BusinessRuleException, EntityNotFoundException } from '@icms/common';
import { RequirePermissions } from '@icms/auth';
import { Archivo } from '../entities/archivo.entity';

/** Referencias permitidas (RF-ARC-003): exactamente UNA debe tener valor. */
const REFERENCIAS = [
  'idPersona',
  'idIngresoEgreso',
  'idMovimiento',
  'idAudiencia',
  'idTraslado',
  'idIncidencia',
] as const;
type Referencia = (typeof REFERENCIAS)[number];

class SubirArchivoDto {
  @IsOptional() @IsUUID() idPersona?: string;
  @IsOptional() @IsUUID() idIngresoEgreso?: string;
  @IsOptional() @IsUUID() idMovimiento?: string;
  @IsOptional() @IsUUID() idAudiencia?: string;
  @IsOptional() @IsUUID() idTraslado?: string;
  @IsOptional() @IsUUID() idIncidencia?: string;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
}

class EditarDescripcionDto {
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
}

/**
 * Tabla y PK del registro dueño de cada referencia, para validar su estado de
 * revisión (QA 03/09): la descripción solo es editable mientras el dueño sigue
 * PENDIENTE. Los archivos del expediente de la persona no pasan por revisión.
 */
const DUENO_POR_REFERENCIA: Record<Referencia, { tabla: string; pk: string } | null> = {
  idPersona: null,
  idIngresoEgreso: { tabla: 'ingreso_egreso', pk: 'idIngresoEgreso' },
  idMovimiento: { tabla: 'movimientos', pk: 'idMovimiento' },
  idAudiencia: { tabla: 'audiencias', pk: 'idAudiencia' },
  idTraslado: { tabla: 'traslados', pk: 'idTraslado' },
  idIncidencia: { tabla: 'incidencias', pk: 'idIncidencia' },
};

/** Clasificación simple del tipo lógico a partir del MIME (FOTO | PDF | DOCUMENTO). */
function clasificar(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'FOTO';
  if (mimeType === 'application/pdf') return 'PDF';
  return 'DOCUMENTO';
}

@Injectable()
export class ArchivosService {
  private readonly logger = new Logger(ArchivosService.name);
  private readonly client: S3Client;
  /** Firma URLs con el endpoint PÚBLICO: la firma AWS V4 incluye el host,
   *  así que debe calcularse con el host que usará el NAVEGADOR, no el
   *  hostname interno de Docker (http://minio:9000). */
  private readonly clientePublico: S3Client;
  private readonly bucket: string;
  private bucketListo = false;

  constructor(
    @InjectRepository(Archivo) private readonly archivos: Repository<Archivo>,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('S3_BUCKET_RECLUSORIO', 'reclusorio-archivos');
    const opciones = {
      region: config.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: parseBoolean(config.get<string>('S3_FORCE_PATH_STYLE'), true),
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY', 'icmsminio'),
        secretAccessKey: config.get<string>('S3_SECRET_KEY', 'icmsminio123'),
      },
    };
    const endpoint = config.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    this.client = new S3Client({ ...opciones, endpoint });
    // S3_PUBLIC_ENDPOINT: cómo llega el navegador a los archivos (p. ej.
    // http://localhost:9000 en dev, https://<dominio> en prod vía nginx).
    this.clientePublico = new S3Client({
      ...opciones,
      endpoint: config.get<string>('S3_PUBLIC_ENDPOINT', '') || endpoint,
    });
  }

  private async asegurarBucket(): Promise<void> {
    if (this.bucketListo) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" creado`);
    }
    this.bucketListo = true;
  }

  /** RF-ARC-003: exactamente una referencia con valor; el backend es la autoridad. */
  private referenciaUnica(dto: SubirArchivoDto): Referencia {
    const presentes = REFERENCIAS.filter((r) => dto[r]);
    if (presentes.length !== 1) {
      throw new BusinessRuleException(
        `El archivo debe referir exactamente a UNA entidad; se recibieron ${presentes.length} referencias`,
      );
    }
    return presentes[0];
  }

  /** RF-ARC-001/002: sube el binario a object storage y persiste los metadatos. */
  async subir(file: Express.Multer.File, dto: SubirArchivoDto): Promise<Archivo> {
    if (!file) throw new BusinessRuleException('No se recibió ningún archivo en el campo "file"');
    const referencia = this.referenciaUnica(dto);
    await this.asegurarBucket();

    const extension = extname(file.originalname).replace('.', '').toLowerCase() || 'bin';
    const nombreAlmacenado = `${uuidv7()}.${extension}`;
    const rutaAlmacenamiento = `${referencia}/${dto[referencia]}/${nombreAlmacenado}`;
    const hashSha256 = createHash('sha256').update(file.buffer).digest('hex');

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: rutaAlmacenamiento,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return this.archivos.save(
      this.archivos.create({
        nombreOriginal: file.originalname,
        nombreAlmacenado,
        tipoArchivo: clasificar(file.mimetype),
        mimeType: file.mimetype,
        extension,
        tamanoBytes: file.size,
        rutaAlmacenamiento,
        hashSha256,
        descripcion: dto.descripcion,
        activo: true,
        [referencia]: dto[referencia],
      }),
    );
  }

  /** RF-ARC-005: lista los archivos de una entidad permitida. */
  /**
   * Biblioteca de la persona (requerimiento 11/08/2026): TODOS los archivos
   * activos asociados al expediente — los propios de la persona y los de sus
   * ingresos/libertades, movimientos, audiencias y traslados — con la entidad
   * de origen para organizarlos visualmente en el frontend.
   */
  bibliotecaDePersona(idPersona: string) {
    return this.archivos.query(
      `SELECT a.*,
              CASE
                WHEN a."idPersona" IS NOT NULL THEN 'persona'
                WHEN a."idIngresoEgreso" IS NOT NULL THEN 'ingresos'
                WHEN a."idMovimiento" IS NOT NULL THEN 'movimientos'
                WHEN a."idAudiencia" IS NOT NULL THEN 'audiencias'
                WHEN a."idTraslado" IS NOT NULL THEN 'traslados'
                ELSE 'incidencias'
              END AS origen
       FROM archivos a
       WHERE a.activo = true AND (
         a."idPersona" = $1
         OR a."idIngresoEgreso" IN (SELECT "idIngresoEgreso" FROM ingreso_egreso WHERE "idPersona" = $1)
         OR a."idMovimiento" IN (SELECT "idMovimiento" FROM movimientos WHERE "idPersona" = $1)
         OR a."idAudiencia" IN (SELECT "idAudiencia" FROM audiencias WHERE "idPersona" = $1)
         OR a."idTraslado" IN (SELECT "idTraslado" FROM traslados WHERE "idPersona" = $1)
       )
       ORDER BY a."fechaRegistro" DESC`,
      [idPersona],
    );
  }

  async porEntidad(referencia: string, id: string) {
    if (!REFERENCIAS.includes(referencia as Referencia)) {
      throw new EntityNotFoundException('Tipo de entidad de archivo', referencia);
    }
    return this.archivos.find({
      where: { [referencia]: id, activo: true },
      order: { fechaRegistro: 'DESC' },
    });
  }

  async obtener(idArchivo: string): Promise<Archivo> {
    const archivo = await this.archivos.findOne({ where: { idArchivo } });
    if (!archivo) throw new EntityNotFoundException('Archivo', idArchivo);
    return archivo;
  }

  /** RF-ARC-005/006: URL temporal de descarga; los inactivos no se entregan. */
  async urlDescarga(idArchivo: string): Promise<{ url: string; hashSha256: string }> {
    const archivo = await this.obtener(idArchivo);
    if (!archivo.activo) throw new BusinessRuleException('El archivo está desactivado');
    const url = await getSignedUrl(
      this.clientePublico,
      new GetObjectCommand({ Bucket: this.bucket, Key: archivo.rutaAlmacenamiento }),
      { expiresIn: 300 },
    );
    return { url, hashSha256: archivo.hashSha256 };
  }

  /** RF-ARC-007: desactivación sin eliminar el registro histórico. */
  async desactivar(idArchivo: string): Promise<Archivo> {
    const archivo = await this.obtener(idArchivo);
    archivo.activo = false;
    return this.archivos.save(archivo);
  }

  /** QA 03/09: editar la descripción mientras el registro dueño no esté confirmado/descartado. */
  async editarDescripcion(idArchivo: string, descripcion?: string): Promise<Archivo> {
    const archivo = await this.obtener(idArchivo);
    if (!archivo.activo) throw new BusinessRuleException('El archivo está desactivado');

    const referencia = REFERENCIAS.find((r) => archivo[r]);
    const dueno = referencia ? DUENO_POR_REFERENCIA[referencia] : null;
    if (dueno && referencia) {
      const filas: Array<{ estadoRevision?: string }> = await this.archivos.query(
        `SELECT "estadoRevision" FROM ${dueno.tabla} WHERE "${dueno.pk}" = $1`,
        [archivo[referencia]],
      );
      const estado = filas[0]?.estadoRevision;
      if (estado && estado !== 'PENDIENTE') {
        throw new BusinessRuleException(
          'La descripción solo puede modificarse mientras el registro está pendiente de revisión',
        );
      }
    }

    // null (no undefined): TypeORM omite undefined y no limpiaría la columna.
    archivo.descripcion = (descripcion?.trim() || null) as unknown as string | undefined;
    return this.archivos.save(archivo);
  }
}

@ApiTags('archivos')
@ApiBearerAuth()
@Controller('archivos')
export class ArchivosController {
  constructor(private readonly service: ArchivosService) {}

  @Post()
  @RequirePermissions('archivos:crear')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir archivo con UNA referencia de entidad (RF-ARC-001..004)' })
  subir(@UploadedFile() file: Express.Multer.File, @Body() dto: SubirArchivoDto) {
    return this.service.subir(file, dto);
  }

  @Get('biblioteca/:idPersona')
  @RequirePermissions('archivos:consultar')
  @ApiOperation({ summary: 'Biblioteca: todos los archivos del expediente de la persona (propios y de sus actividades)' })
  biblioteca(@Param('idPersona') idPersona: string) {
    return this.service.bibliotecaDePersona(idPersona);
  }

  @Get('de/:entidad/:id')
  @RequirePermissions('archivos:consultar')
  @ApiOperation({ summary: 'Archivos activos de una entidad (idPersona, idAudiencia, ...) (RF-ARC-005)' })
  porEntidad(@Param('entidad') entidad: string, @Param('id') id: string) {
    return this.service.porEntidad(entidad, id);
  }

  @Get(':id/descarga')
  @RequirePermissions('archivos:consultar')
  @ApiOperation({ summary: 'URL temporal de descarga + hash para verificación (RF-ARC-005/006)' })
  descarga(@Param('id') id: string) {
    return this.service.urlDescarga(id);
  }

  @Post(':id/desactivar')
  @RequirePermissions('archivos:administrar')
  @ApiOperation({ summary: 'Desactivar sin eliminar el histórico (RF-ARC-007)' })
  desactivar(@Param('id') id: string) {
    return this.service.desactivar(id);
  }

  @Patch(':id/descripcion')
  @RequirePermissions('archivos:crear')
  @ApiOperation({
    summary: 'Editar la descripción mientras el registro dueño está pendiente de revisión (QA 03/09)',
  })
  editarDescripcion(@Param('id') id: string, @Body() dto: EditarDescripcionDto) {
    return this.service.editarDescripcion(id, dto.descripcion);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([Archivo])],
  controllers: [ArchivosController],
  providers: [ArchivosService],
})
export class ArchivosModule {}
