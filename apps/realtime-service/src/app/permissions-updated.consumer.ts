import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { DomainEvent, EventNames, UserPermissionsUpdatedPayload } from '@icms/contracts';
import { RealtimeGateway } from './realtime.gateway';

/**
 * RF-SES-009 / DP-009: cuando auth-service actualiza permisos de un usuario,
 * se notifica al cliente EN TIEMPO REAL para que rote su token y actualice
 * su menú y controles sin esperar a la siguiente petición ni cerrar sesión.
 */
@Injectable()
export class PermissionsUpdatedConsumer {
  private readonly logger = new Logger(PermissionsUpdatedConsumer.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @RabbitSubscribe({
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'icms.events',
    routingKey: EventNames.UserPermissionsUpdated,
    queue: 'realtime-service.permissions-updated',
  })
  onPermissionsUpdated(event: DomainEvent<UserPermissionsUpdatedPayload>): void {
    const { userId, permissions } = event.payload;
    if (!userId) return;
    this.gateway.emitToUser(userId, 'permissions.updated', { userId, permissions });
    this.logger.log(`Permisos actualizados para usuario ${userId} → notificado por WebSocket`);
  }
}
