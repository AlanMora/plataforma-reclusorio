import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { DatabaseModule } from '@icms/database';
import { EntityNotFoundException, PaginationQueryDto, paginate } from '@icms/common';
import { AuthenticatedUser, CurrentUser } from '@icms/auth';
import { Idempotent } from '@icms/redis';
import { OutboxService } from '@icms/messaging';
import { EventNames } from '@icms/contracts';
import { FileMetadata } from './file.entity';
import { StorageService } from './storage.service';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileMetadata) private readonly files: Repository<FileMetadata>,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  async upload(file: Express.Multer.File, user: AuthenticatedUser): Promise<FileMetadata> {
    const objectKey = `${user.tenantId ?? 'public'}/${randomUUID()}-${file.originalname}`;
    // El binario se sube primero al object storage (recurso externo).
    await this.storage.put(objectKey, file.buffer, file.mimetype);

    // Metadatos + evento FileUploaded en la MISMA transacción (Outbox).
    return this.dataSource.transaction(async (manager) => {
      const metadata = await manager.save(
        manager.getRepository(FileMetadata).create({
          tenantId: user.tenantId,
          createdBy: user.id,
          bucket: this.storage.bucket,
          objectKey,
          originalName: file.originalname,
          contentType: file.mimetype,
          size: file.size,
          antivirusStatus: 'pending', // TODO(proyecto): antivirus antes de "clean"
        }),
      );
      await this.outbox.enqueue(
        manager,
        EventNames.FileUploaded,
        {
          fileId: metadata.id,
          bucket: metadata.bucket,
          key: objectKey,
          size: file.size,
          contentType: file.mimetype,
        },
        { tenantId: user.tenantId, aggregateId: metadata.id },
      );
      return metadata;
    });
  }

  async temporaryUrl(id: string): Promise<{ url: string }> {
    const meta = await this.findOne(id);
    return { url: await this.storage.presignedDownload(meta.objectKey) };
  }

  async findOne(id: string): Promise<FileMetadata> {
    const meta = await this.files.findOne({ where: { id } });
    if (!meta) throw new EntityNotFoundException('Archivo', id);
    return meta;
  }

  async list(query: PaginationQueryDto, user: AuthenticatedUser) {
    const [items, total] = await this.files.findAndCount({
      where: user.tenantId ? { tenantId: user.tenantId } : {},
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(items, total, query);
  }

  /** Borrado lógico de los metadatos; el binario permanece en el object storage. */
  async remove(id: string): Promise<void> {
    const meta = await this.findOne(id);
    await this.files.softRemove(meta);
  }
}

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @Idempotent()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir un archivo (idempotente + outbox)' })
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    return this.files.upload(file, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar archivos del tenant (paginado)' })
  list(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.files.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener los metadatos de un archivo' })
  findOne(@Param('id') id: string) {
    return this.files.findOne(id);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Obtener URL temporal de descarga (presigned)' })
  url(@Param('id') id: string) {
    return this.files.temporaryUrl(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar (borrado lógico) un archivo' })
  remove(@Param('id') id: string) {
    return this.files.remove(id);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([FileMetadata])],
  controllers: [FilesController],
  providers: [FilesService, StorageService],
})
export class FilesModule {}
