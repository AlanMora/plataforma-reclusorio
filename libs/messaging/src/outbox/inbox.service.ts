import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { InboxEvent } from './outbox.entities';

/**
 * Dedup de consumidores (Inbox). Ejecuta `handler` una sola vez por
 * (eventId, consumer): inserta el registro de inbox y corre el handler en la
 * MISMA transacción. Si el evento ya fue procesado, lo omite.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly dataSource: DataSource) {}

  async processOnce(
    eventId: string,
    consumer: string,
    handler: (manager: EntityManager) => Promise<void>,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(InboxEvent)
        .values({ eventId, consumer })
        .orIgnore() // ON CONFLICT DO NOTHING
        .execute();

      const inserted = (result.identifiers?.length ?? 0) > 0 || (result.raw?.length ?? 0) > 0;
      if (!inserted) {
        this.logger.debug(`Evento ${eventId} ya procesado por ${consumer}, se omite`);
        return false;
      }
      await handler(manager);
      return true;
    });
  }
}
