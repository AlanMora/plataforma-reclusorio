import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import {
  SharedAuthModule,
  JwtAuthGuard,
  PermissionsGuard,
  RolesGuard,
  TenantContextInterceptor,
} from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { MessagingModule, OutboxModule, OutboxEvent, InboxEvent } from '@icms/messaging';
import { RedisModule, IdempotencyInterceptor } from '@icms/redis';
import { User } from './users/user.entity';
import { AuditLog } from './audit/audit-log.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecoveryModule } from './recovery/recovery.module';
import { TwoFactorModule } from './twofa/twofa.module';
import { AuditModule } from './audit/audit.module';
import { Init1786404410447 } from '../migrations/1786404410447-Init';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    SharedAuthModule,
    RedisModule,
    MessagingModule.forRoot(),
    DatabaseModule.forRoot({
      database: 'icms_auth',
      entities: [User, AuditLog, OutboxEvent, InboxEvent],
      // Clase importada para que webpack la empaquete; corre al arrancar en producción.
      migrations: [Init1786404410447],
    }),
    OutboxModule.forRoot({ withRelay: true }),
    AuthModule,
    UsersModule,
    RecoveryModule,
    TwoFactorModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Los permisos y roles se verifican SIEMPRE en el backend (RF-SEG-002).
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
