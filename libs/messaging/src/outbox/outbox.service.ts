import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EventPublisher, PublishMeta } from '../event-publisher.service';
import { OutboxEvent } from './outbox.entities';

/**
 * Encola un evento de dominio en el Outbox usando el MISMO EntityManager de la
 * transacción de negocio. Así el evento se persiste atómicamente con el cambio;
 * el OutboxRelay lo publica después.
 *
 *   await dataSource.transaction(async (m) => {
 *     await m.save(entity);
 *     await outbox.enqueue(m, 'incident.created', { id: entity.id }, { tenantId, aggregateId: entity.id });
 *   });
 */
@Injectable()
export class OutboxService {
  constructor(private readonly publisher: EventPublisher) {}

  async enqueue<T>(manager: EntityManager, name: string, payload: T, meta: PublishMeta = {}): Promise<void> {
    const event = this.publisher.buildEvent(name, payload, meta);
    await manager.getRepository(OutboxEvent).insert({
      id: event.eventId,
      routingKey: name,
      event: event as any, // jsonb opaco
      status: 'pending',
      attempts: 0,
    });
  }
}
