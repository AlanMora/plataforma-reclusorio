import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/** Registro de auditoría de seguridad (logins, cambios de contraseña, revocaciones). */
@Entity('security_audit_logs')
export class AuditLog extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column()
  action!: string;

  @Column({ nullable: true })
  outcome?: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, unknown>;
}
