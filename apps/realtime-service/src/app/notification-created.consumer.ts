import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { DomainEvent, EventNames, NotificationCreatedPayload } from '@icms/contracts';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Campana en tiempo real: cuando el notification-service persiste una
 * notificación en la bandeja, se empuja al instante a la sala del usuario
 * para que el contador y el panel del navbar se actualicen sin recargar.
 */
@Injectable()
export class NotificationCreatedConsumer {
  private readonly logger = new Logger(NotificationCreatedConsumer.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @RabbitSubscribe({
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'icms.events',
    routingKey: EventNames.NotificationCreated,
    queue: 'realtime-service.notification-created',
  })
  onNotificationCreated(event: DomainEvent<NotificationCreatedPayload>): void {
    const { userId } = event.payload;
    if (!userId) return;
    this.gateway.emitToUser(userId, 'notification.created', event.payload);
    this.logger.debug(`Notificación ${event.payload.id} → usuario ${userId}`);
  }
}
