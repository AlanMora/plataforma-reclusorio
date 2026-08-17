import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/**
 * Bandeja de notificaciones por usuario (RF-NOT-001..004). Persistencia
 * propia del notification-service — permitida por DP-001 (no forma parte
 * del esquema de dominio del reclusorio).
 */
@Entity('user_notifications')
export class UserNotification extends BaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ nullable: true })
  titulo?: string;

  @Column({ type: 'varchar', length: 2000 })
  mensaje!: string;

  @Column({ default: false })
  leida!: boolean;

  /** Destino dentro del sistema ("Ver" en la campana), p.ej. /personas/{id}. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  url?: string;
}
