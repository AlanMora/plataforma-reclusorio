import { Body, Controller, Get, HttpCode, Injectable, Logger, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { DatabaseModule } from '@icms/database';
import { AuthenticatedUser, CurrentUser } from '@icms/auth';
import { PaginationQueryDto, paginate } from '@icms/common';
import { EntityNotFoundException } from '@icms/common';
import { ILike } from 'typeorm';
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
import { UserNotification } from './user-notification.entity';

class InboxQueryDto extends PaginationQueryDto {
  /** Texto a buscar en título y mensaje (RF-NOT-003). */
  @IsOptional() @IsString() buscar?: string;
}

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
    @InjectRepository(UserNotification)
    private readonly inboxRepo: Repository<UserNotification>,
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
      // Canal interno: además de "enviarse", queda en la bandeja del usuario (RF-NOT-001).
      if (dto.channel === 'internal') {
        await this.inboxRepo.save(
          this.inboxRepo.create({ userId: dto.to, titulo: dto.template, mensaje: body }),
        );
      }
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

  /** RF-NOT-001/003/004: bandeja del usuario con búsqueda y paginación. */
  async inbox(userId: string, query: PaginationQueryDto, buscar?: string) {
    const where = buscar
      ? [
          { userId, mensaje: ILike(`%${buscar}%`) },
          { userId, titulo: ILike(`%${buscar}%`) },
        ]
      : { userId };
    const [items, total] = await this.inboxRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(items, total, query);
  }

  /** RF-NOT-002: marcar como leída; el estado persiste. */
  async marcarLeida(userId: string, id: string): Promise<UserNotification> {
    const notif = await this.inboxRepo.findOne({ where: { id, userId } });
    if (!notif) throw new EntityNotFoundException('Notificación', id);
    notif.leida = true;
    return this.inboxRepo.save(notif);
  }

  async getDelivery(id: string): Promise<NotificationDelivery> {
    const delivery = await this.deliveries.findOne({ where: { id } });
    if (!delivery) throw new EntityNotFoundException('Notificación', id);
    return delivery;
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

  @Get('inbox')
  @ApiOperation({ summary: 'Bandeja del usuario: buscable y paginada (RF-NOT-001/003/004)' })
  inbox(@CurrentUser() user: AuthenticatedUser, @Query() query: InboxQueryDto) {
    return this.notifications.inbox(user.id, query, query.buscar);
  }

  @Post('inbox/:id/leida')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar una notificación como leída (RF-NOT-002)' })
  marcarLeida(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notifications.marcarLeida(user.id, id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Historial de entregas (últimas 100)' })
  history() {
    return this.notifications.history();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el estado de una entrega por id' })
  getDelivery(@Param('id') id: string) {
    return this.notifications.getDelivery(id);
  }
}

@Module({
  imports: [DatabaseModule.forFeature([NotificationDelivery, UserNotification])],
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
