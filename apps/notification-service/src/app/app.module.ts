import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { SharedAuthModule, JwtAuthGuard, TenantContextInterceptor } from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { MessagingModule, OutboxModule, OutboxEvent, InboxEvent } from '@icms/messaging';
import { RedisModule, IdempotencyInterceptor } from '@icms/redis';
import { NotificationDelivery } from './delivery.entity';
import { UserNotification } from './user-notification.entity';
import { NotificationsModule } from './notifications.module';
import { Init1786404412159 } from '../migrations/1786404412159-Init';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    SharedAuthModule,
    RedisModule,
    MessagingModule.forRoot(),
    DatabaseModule.forRoot({
      database: 'icms_notification',
      entities: [NotificationDelivery, UserNotification, OutboxEvent, InboxEvent],
      // Clase importada para que webpack la empaquete; corre al arrancar en producción.
      migrations: [Init1786404412159],
    }),
    // Sin relay: este servicio consume eventos (usa Inbox para dedup), no publica.
    OutboxModule.forRoot({ withRelay: false }),
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
