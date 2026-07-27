import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/** Historial de entrega de notificaciones (con soporte de reintentos). */
@Entity('notification_deliveries')
export class NotificationDelivery extends BaseEntity {
  @Index()
  @Column()
  channel!: string;

  @Column()
  to!: string;

  @Column()
  template!: string;

  @Column({ default: 'pending' })
  status!: string; // pending | sent | failed

  @Column({ default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', nullable: true })
  lastError?: string;
}
