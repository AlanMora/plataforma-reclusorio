import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/** Institución / tenant raíz de la jerarquía organizacional. */
@Entity('institutions')
export class Institution extends BaseEntity {
  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ default: true })
  active!: boolean;
}

/** Sucursal perteneciente a una institución. */
@Entity('branches')
export class Branch extends BaseEntity {
  @Index()
  @Column({ name: 'institution_id' })
  institutionId!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  address?: string;
}

/** Usuario operativo (del negocio), distinto del usuario de acceso de auth-service. */
@Entity('operational_users')
export class OperationalUser extends BaseEntity {
  @Index()
  @Column({ name: 'institution_id' })
  institutionId!: string;

  @Column({ name: 'branch_id', nullable: true })
  branchId?: string;

  @Column({ name: 'auth_user_id', nullable: true })
  authUserId?: string;

  @Column()
  fullName!: string;

  @Column('simple-array', { default: '' })
  roleIds!: string[];
}
