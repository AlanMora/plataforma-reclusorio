import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { EventPublisher } from '@icms/messaging';
import { EventNames } from '@icms/contracts';

/**
 * Difunde los movimientos del dominio a la campana de todos los usuarios:
 * publica `notification.requested` con destino '*'; el notification-service
 * lo persiste por usuario en su bandeja y el realtime-service lo empuja al
 * navbar en tiempo real. Fire-and-forget: una caída del broker jamás debe
 * revertir ni retrasar la operación de negocio que la originó.
 */
@Injectable()
export class NotificadorDominio {
  private readonly logger = new Logger(NotificadorDominio.name);

  constructor(private readonly events: EventPublisher) {}

  difundir(titulo: string, mensaje: string, url?: string): void {
    void this.events
      .publish(EventNames.NotificationRequested, {
        channel: 'internal',
        to: '*',
        template: titulo,
        variables: { mensaje, url },
      })
      .catch((err: Error) =>
        this.logger.warn(`No se pudo difundir "${titulo}": ${err.message}`),
      );
  }
}

@Global()
@Module({
  providers: [NotificadorDominio],
  exports: [NotificadorDominio],
})
export class NotificadorDominioModule {}
