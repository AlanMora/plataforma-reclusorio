import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { DatabaseModule } from '@icms/database';
import { EntityNotFoundException } from '@icms/common';
import { AuthenticatedUser, CurrentUser } from '@icms/auth';
import { EventPublisher } from '@icms/messaging';
import { EventNames } from '@icms/contracts';
import { FileMetadata } from './file.entity';
import { StorageService } from './storage.service';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileMetadata) private readonly files: Repository<FileMetadata>,
    private readonly storage: StorageService,
    private readonly events: EventPublisher,
  ) {}

  async upload(file: Express.Multer.File, user: AuthenticatedUser): Promise<FileMetadata> {
    const objectKey = `${user.tenantId ?? 'public'}/${randomUUID()}-${file.originalname}`;
    await this.storage.put(objectKey, file.buffer, file.mimetype);

    // TODO(proyecto): encolar análisis antivirus antes de marcar como "clean".
    const metadata = await this.files.save(
      this.files.create({
        tenantId: user.tenantId,
        bucket: this.storage.bucket,
        objectKey,
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        antivirusStatus: 'pending',
      }),
    );

    await this.events.publish(EventNames.FileUploaded, {
      fileId: metadata.id,
      bucket: metadata.bucket,
      key: objectKey,
      size: file.size,
      contentType: file.mimetype,
    });
    return metadata;
  }

  async temporaryUrl(id: string): Promise<{ url: string }> {
    const meta = await this.files.findOne({ where: { id } });
    if (!meta) throw new EntityNotFoundException('Archivo', id);
    return { url: await this.storage.presignedDownload(meta.objectKey) };
  }
}

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir un archivo' })
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    return this.files.upload(file, user);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Obtener URL temporal de descarga' })
  url(@Param('id') id: string) {
    return this.files.temporaryUrl(id);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([FileMetadata])],
  controllers: [FilesController],
  providers: [FilesService, StorageService],
})
export class FilesModule {}
