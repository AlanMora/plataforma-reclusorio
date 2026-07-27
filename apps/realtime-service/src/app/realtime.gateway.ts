import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/**
 * Gateway WebSocket. Autentica cada conexión con el JWT (handshake) y expone un
 * canal básico de suscripción. La emisión entre instancias la resuelve el
 * adaptador Redis configurado en `main.ts`.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    const token =
      (client.handshake.auth?.token as string) ??
      (client.handshake.headers.authorization?.replace('Bearer ', '') ?? '');
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET', 'change-me-in-production'),
        issuer: this.config.get<string>('JWT_ISSUER', 'icms-platform'),
      });
      client.data.user = { id: payload.sub, tenantId: payload.tenantId };
      // Sala por tenant para difusión segmentada.
      if (payload.tenantId) client.join(`tenant:${payload.tenantId}`);
      this.logger.debug(`Cliente conectado: ${payload.sub}`);
    } catch {
      this.logger.debug('Conexión WebSocket rechazada: token inválido');
      client.disconnect(true);
    }
  }

  @SubscribeMessage('ping')
  onPing(@ConnectedSocket() _client: Socket, @MessageBody() data: unknown): { event: string; data: unknown } {
    return { event: 'pong', data };
  }

  /** Utilidad para que otros flujos emitan a un tenant concreto. */
  emitToTenant(tenantId: string, event: string, payload: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }
}
