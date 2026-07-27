import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@icms/database';

/**
 * Mensaje de salida hacia un sistema externo (patrón outbox). Permite reintentos
 * y conciliación sin acoplar el dominio a los errores del sistema remoto.
 */
@Entity('integration_outbox')
export class OutboxMessage extends BaseEntity {
  @Index()
  @Column()
  destination!: string; // nombre del sistema externo / conector

  @Column()
  operation!: string;

  @Column('jsonb')
  payload!: Record<string, unknown>;

  @Index()
  @Column({ default: 'pending' })
  status!: string; // pending | sent | failed | reconciled

  @Column({ default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', nullable: true })
  lastError?: string;
}
