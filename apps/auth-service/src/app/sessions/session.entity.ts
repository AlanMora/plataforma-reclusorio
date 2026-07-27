import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/** Sesión activa. Base para revocación y control de refresh tokens. */
@Entity('sessions')
export class Session extends BaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'refresh_token_hash' })
  refreshTokenHash!: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
