import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/**
 * Metadatos del archivo. El binario vive en object storage (MinIO/S3); los
 * demás servicios guardan una referencia a `id`, nunca el binario.
 */
@Entity('files')
export class FileMetadata extends BaseEntity {
  @Index()
  @Column({ name: 'tenant_id', nullable: true })
  tenantId?: string;

  @Column()
  bucket!: string;

  @Column({ name: 'object_key' })
  objectKey!: string;

  @Column({ name: 'original_name' })
  originalName!: string;

  @Column({ name: 'content_type' })
  contentType!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @Column({ default: 1 })
  fileVersion!: number;

  @Column({ name: 'antivirus_status', default: 'pending' })
  antivirusStatus!: string; // pending | clean | infected
}
