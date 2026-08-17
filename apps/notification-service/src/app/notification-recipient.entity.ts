import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/**
 * Proyección de destinatarios para las notificaciones de difusión (`to: '*'`):
 * se alimenta del evento `user.logged_in` del auth-service, así que todo el
 * que haya iniciado sesión al menos una vez recibe las difusiones siguientes.
 * Este servicio no puede consultar la BD del auth (DP-001); esta proyección
 * es su vista local de "usuarios conocidos".
 */
@Entity('notification_recipients')
export class NotificationRecipient extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;
}
