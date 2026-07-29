import { ConfigService } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { EventPublisher } from './event-publisher.service';

const configWith = (values: Record<string, string>): ConfigService =>
  ({ get: (key: string, def?: string) => values[key] ?? def }) as unknown as ConfigService;

describe('EventPublisher.buildEvent', () => {
  const publisher = new EventPublisher(
    {} as unknown as AmqpConnection,
    configWith({ RABBITMQ_EXCHANGE: 'icms.events', SERVICE_NAME: 'auth-service' }),
  );

  it('arma el contrato estándar de evento (§7.2)', () => {
    const event = publisher.buildEvent('user.registered', { userId: 'u1' }, { tenantId: 't1', aggregateId: 'u1' });
    expect(event.eventType).toBe('user.registered.v1');
    expect(event.producer).toBe('auth-service');
    expect(event.schemaVersion).toBe(1);
    expect(event.tenantId).toBe('t1');
    expect(event.aggregateId).toBe('u1');
    expect(event.payload).toEqual({ userId: 'u1' });
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(typeof event.occurredAt).toBe('string');
  });

  it('respeta un schemaVersion explícito', () => {
    const event = publisher.buildEvent('order.created', {}, { schemaVersion: 2 });
    expect(event.eventType).toBe('order.created.v2');
    expect(event.schemaVersion).toBe(2);
  });
});
