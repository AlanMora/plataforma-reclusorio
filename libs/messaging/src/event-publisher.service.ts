import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { randomUUID } from 'node:crypto';
import { DomainEvent } from '@icms/contracts';

/**
 * Publica eventos de dominio en el exchange topic. Rellena metadatos comunes
 * (eventId, occurredAt) y usa el nombre del evento como routing key.
 */
@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly exchange: string;

  constructor(
    private readonly amqp: AmqpConnection,
    config: ConfigService,
  ) {
    this.exchange = config.get<string>('RABBITMQ_EXCHANGE', 'icms.events');
  }

  async publish<T>(
    name: string,
    payload: T,
    meta: { correlationId?: string; tenantId?: string } = {},
  ): Promise<void> {
    const event: DomainEvent<T> = {
      name,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      correlationId: meta.correlationId,
      tenantId: meta.tenantId,
      payload,
    };

    await this.amqp.publish(this.exchange, name, event, {
      messageId: event.eventId,
      correlationId: meta.correlationId,
      contentType: 'application/json',
      persistent: true,
    });

    this.logger.debug(`Evento publicado: ${name} (${event.eventId})`);
  }
}
