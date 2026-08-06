import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { DomainEvent, EventNames } from '@icms/contracts';
import { RealtimeGateway } from './realtime.gateway';

interface SessionRevokedPayload {
  sessionId: string;
  userId?: string;
  motivo?: string;
}

/**
 * RF-SES-009 / DP-009: cuando auth-service revoca una sesión, se notifica al
 * cliente EN TIEMPO REAL para que abandone la sesión sin esperar a la
 * siguiente petición.
 */
@Injectable()
export class SessionRevokedConsumer {
  private readonly logger = new Logger(SessionRevokedConsumer.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @RabbitSubscribe({
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'icms.events',
    routingKey: EventNames.SessionRevoked,
    queue: 'realtime-service.session-revoked',
  })
  onSessionRevoked(event: DomainEvent<SessionRevokedPayload>): void {
    const { userId, sessionId, motivo } = event.payload;
    if (!userId) return;
    this.gateway.emitToUser(userId, 'session.revoked', { sessionId, motivo });
    this.logger.log(`Sesión ${sessionId} revocada → notificado usuario ${userId}`);
  }
}
