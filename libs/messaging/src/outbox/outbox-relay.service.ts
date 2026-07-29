import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { EventPublisher } from '../event-publisher.service';
import { OutboxEvent } from './outbox.entities';

const MAX_ATTEMPTS = 10;
const BATCH = 50;

/**
 * Relay del Outbox: cada pocos segundos toma eventos `pending` y los publica al
 * broker, marcándolos `published`. Usa `FOR UPDATE SKIP LOCKED` para que varias
 * instancias no publiquen el mismo evento (seguro en despliegue con réplicas).
 */
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: EventPublisher,
  ) {}

  @Interval('outbox-relay', 3000)
  async flush(): Promise<void> {
    if (this.running) return; // evita solapamiento de ejecuciones
    this.running = true;
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(OutboxEvent);
        const rows = await repo
          .createQueryBuilder('o')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .where('o.status = :status', { status: 'pending' })
          .orderBy('o.created_at', 'ASC')
          .limit(BATCH)
          .getMany();

        for (const row of rows) {
          try {
            await this.publisher.publishEvent(row.routingKey, row.event);
            row.status = 'published';
            row.publishedAt = new Date();
          } catch (err) {
            row.attempts += 1;
            row.lastError = (err as Error).message;
            if (row.attempts >= MAX_ATTEMPTS) row.status = 'failed';
            this.logger.warn(`Outbox ${row.id} intento ${row.attempts}: ${row.lastError}`);
          }
          await repo.save(row);
        }
      });
    } catch (err) {
      this.logger.error(`Fallo en el relay de outbox: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
