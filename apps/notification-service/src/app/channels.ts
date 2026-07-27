import { Injectable, Logger } from '@nestjs/common';

export type Channel = 'email' | 'sms' | 'push' | 'internal';

export interface OutboundMessage {
  channel: Channel;
  to: string;
  subject?: string;
  body: string;
}

/**
 * Abstracción de proveedores de notificación. Cada canal se implementa detrás
 * de la misma interfaz para que el resto de la plataforma no reimplemente
 * mecanismos de comunicación. En el andamiaje son stubs que registran el envío.
 */
export interface NotificationChannel {
  readonly channel: Channel;
  send(message: OutboundMessage): Promise<void>;
}

@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly channel: Channel = 'email';
  private readonly logger = new Logger(EmailChannel.name);
  async send(message: OutboundMessage): Promise<void> {
    // TODO(proyecto): integrar nodemailer/SES usando SMTP_* del entorno.
    this.logger.log(`(stub) email -> ${message.to}: ${message.subject ?? ''}`);
  }
}

@Injectable()
export class SmsChannel implements NotificationChannel {
  readonly channel: Channel = 'sms';
  private readonly logger = new Logger(SmsChannel.name);
  async send(message: OutboundMessage): Promise<void> {
    this.logger.log(`(stub) sms -> ${message.to}`);
  }
}

@Injectable()
export class PushChannel implements NotificationChannel {
  readonly channel: Channel = 'push';
  private readonly logger = new Logger(PushChannel.name);
  async send(message: OutboundMessage): Promise<void> {
    this.logger.log(`(stub) push -> ${message.to}`);
  }
}

@Injectable()
export class InternalChannel implements NotificationChannel {
  readonly channel: Channel = 'internal';
  private readonly logger = new Logger(InternalChannel.name);
  async send(message: OutboundMessage): Promise<void> {
    this.logger.log(`(stub) internal -> ${message.to}`);
  }
}
