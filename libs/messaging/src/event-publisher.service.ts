import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { randomUUID } from 'node:crypto';
import { DomainEvent } from '@icms/contracts';

export interface PublishMeta {
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  tenantId?: string;
  aggregateId?: string;
  /** Versión del schema del payload (por defecto 1). */
  schemaVersion?: number;
}

/**
 * Publica eventos de dominio en el exchange topic con el contrato estándar (§7.2):
 * rellena eventId, eventType (`nombre.vN`), producer, occurredAt y metadatos de
 * correlación/causalidad. La routing key es el `name` base (sin versión) para que
 * las suscripciones existentes sigan casando.
 *
 * Nota: para publicación transaccional confiable usa el OutboxService; este
 * publicador directo es válido para eventos no críticos o desde el relay del outbox.
 */
@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly exchange: string;
  private readonly producer: string;

  constructor(
    private readonly amqp: AmqpConnection,
    config: ConfigService,
  ) {
    this.exchange = config.get<string>('RABBITMQ_EXCHANGE', 'icms.events');
    this.producer = config.get<string>('SERVICE_NAME', 'unknown-service');
  }

  buildEvent<T>(name: string, payload: T, meta: PublishMeta = {}): DomainEvent<T> {
    const schemaVersion = meta.schemaVersion ?? 1;
    return {
      eventId: randomUUID(),
      eventType: `${name}.v${schemaVersion}`,
      occurredAt: new Date().toISOString(),
      producer: this.producer,
      correlationId: meta.correlationId,
      causationId: meta.causationId,
      traceId: meta.traceId,
      tenantId: meta.tenantId,
      aggregateId: meta.aggregateId,
      schemaVersion,
      payload,
    };
  }

  async publish<T>(name: string, payload: T, meta: PublishMeta = {}): Promise<void> {
    const event = this.buildEvent(name, payload, meta);
    await this.publishEvent(name, event);
  }

  /** Publica un evento ya construido (usado por el relay del Outbox). */
  async publishEvent<T>(routingKey: string, event: DomainEvent<T>): Promise<void> {
    await this.amqp.publish(this.exchange, routingKey, event, {
      messageId: event.eventId,
      correlationId: event.correlationId,
      contentType: 'application/json',
      persistent: true,
    });
    this.logger.debug(`Evento publicado: ${event.eventType} (${event.eventId})`);
  }
}
