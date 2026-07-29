import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Tabla Outbox (§7.1): el evento se escribe en la MISMA transacción que el cambio
 * de negocio; un relay lo publica después al broker de forma confiable.
 */
@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryColumn('uuid')
  id!: string; // = event.eventId

  @Column({ name: 'routing_key' })
  routingKey!: string;

  // jsonb opaco: guarda el DomainEvent serializado (tipado como any para evitar
  // la recursión de tipos de TypeORM sobre `payload: unknown`).
  @Column('jsonb')
  event!: any;

  @Index()
  @Column({ default: 'pending' })
  status!: 'pending' | 'published' | 'failed';

  @Column({ default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;
}

/**
 * Tabla Inbox (§7.1): registra los eventos ya procesados por un consumidor para
 * garantizar idempotencia (at-least-once + dedup = efecto exactly-once).
 */
@Entity('inbox_events')
@Index(['eventId', 'consumer'], { unique: true })
export class InboxEvent {
  @PrimaryColumn('uuid')
  eventId!: string;

  @PrimaryColumn()
  consumer!: string;

  @Column({ name: 'processed_at', type: 'timestamptz', default: () => 'now()' })
  processedAt!: Date;
}
