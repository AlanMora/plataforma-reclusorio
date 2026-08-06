import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/** Usuario de acceso (identidad). No confundir con "usuarios operativos" de configuration-service. */
@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column()
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled!: boolean;

  @Column('simple-array', { default: '' })
  roles!: string[];

  /**
   * Permisos efectivos que viajan en el JWT (p. ej. "personas:crear").
   * En el estándar completo se resuelven desde roles del configuration-service;
   * esta columna permite otorgarlos directamente mientras tanto.
   */
  @Column('simple-array', { default: '' })
  permissions!: string[];
}
