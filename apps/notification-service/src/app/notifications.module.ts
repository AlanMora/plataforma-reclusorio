import { Body, Controller, Get, Injectable, Logger, Module, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { InboxService } from '@icms/messaging';
import { Idempotent } from '@icms/redis';
import { DomainEvent, EventNames, NotificationRequestedPayload } from '@icms/contracts';
import {
  Channel,
  EmailChannel,
  InternalChannel,
  NotificationChannel,
  PushChannel,
  SmsChannel,
} from './channels';
import { NotificationDelivery } from './delivery.entity';

class SendNotificationDto {
  @IsIn(['email', 'sms', 'push', 'internal']) channel!: Channel;
  @IsString() @IsNotEmpty() to!: string;
  @IsString() @IsNotEmpty() template!: string;
  @IsOptional() @IsObject() variables?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly channels: Record<Channel, NotificationChannel>;

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveries: Repository<NotificationDelivery>,
    email: EmailChannel,
    sms: SmsChannel,
    push: PushChannel,
    internal: InternalChannel,
  ) {
    this.channels = { email, sms, push, internal };
  }

  /** Renderiza la plantilla (stub) y despacha por el canal correspondiente. */
  async dispatch(dto: SendNotificationDto): Promise<NotificationDelivery> {
    const delivery = await this.deliveries.save(
      this.deliveries.create({ channel: dto.channel, to: dto.to, template: dto.template }),
    );
    try {
      const body = `[${dto.template}] ${JSON.stringify(dto.variables ?? {})}`;
      await this.channels[dto.channel].send({ channel: dto.channel, to: dto.to, body });
      delivery.status = 'sent';
    } catch (err) {
      delivery.status = 'failed';
      delivery.lastError = (err as Error).message;
      // TODO(proyecto): reintentos con backoff vía cola de reintento + DLX.
    }
    delivery.attempts += 1;
    return this.deliveries.save(delivery);
  }

  history() {
    return this.deliveries.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}

/** Suscriptor de eventos: reacciona a `notification.requested` publicado por otros servicios. */
@Injectable()
export class NotificationConsumer {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly inbox: InboxService,
  ) {}

  @RabbitSubscribe({
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'icms.events',
    routingKey: EventNames.NotificationRequested,
    queue: 'notification-service.requested',
  })
  async onNotificationRequested(event: DomainEvent<NotificationRequestedPayload>): Promise<void> {
    // Inbox: procesa el evento una sola vez aunque el broker lo entregue duplicado.
    await this.inbox.processOnce(event.eventId, 'notification-service', async () => {
      const { channel, to, template, variables } = event.payload;
      await this.notifications.dispatch({ channel, to, template, variables });
    });
  }
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('send')
  @Idempotent()
  @ApiOperation({ summary: 'Enviar una notificación directa (idempotente)' })
  send(@Body() dto: SendNotificationDto) {
    return this.notifications.dispatch(dto);
  }

  @Get('history')
  history() {
    return this.notifications.history();
  }
}

@Module({
  imports: [DatabaseModule.forFeature([NotificationDelivery])],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationConsumer,
    EmailChannel,
    SmsChannel,
    PushChannel,
    InternalChannel,
  ],
})
export class NotificationsModule {}
