import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { parseBoolean } from '@icms/config';

/**
 * Adaptador de object storage (MinIO / S3). Sube y descarga binarios y genera
 * URLs temporales (presigned) para acceso controlado sin exponer credenciales.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'icms-files');
    this.client = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT', 'http://localhost:9000'),
      region: config.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: parseBoolean(config.get<string>('S3_FORCE_PATH_STYLE'), true),
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY', 'icmsminio'),
        secretAccessKey: config.get<string>('S3_SECRET_KEY', 'icmsminio123'),
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** Genera una URL temporal de descarga (por defecto 5 min). */
  presignedDownload(key: string, expiresIn = 300): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn,
    });
  }
}
