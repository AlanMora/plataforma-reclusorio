import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { SharedAuthModule, JwtAuthGuard, TenantContextInterceptor } from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { MessagingModule, OutboxModule, OutboxEvent, InboxEvent } from '@icms/messaging';
import { RedisModule, IdempotencyInterceptor } from '@icms/redis';
import { ExampleEntity } from './example/example.entity';
import { ExampleModule } from './example/example.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    SharedAuthModule,
    RedisModule,
    MessagingModule.forRoot(),
    DatabaseModule.forRoot({ database: 'icms_core', entities: [ExampleEntity, OutboxEvent, InboxEvent] }),
    OutboxModule.forRoot({ withRelay: true }),
    ExampleModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Contexto multi-tenant por petición + idempotencia (opt-in por @Idempotent()).
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
