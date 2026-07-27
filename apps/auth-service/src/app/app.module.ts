import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { SharedAuthModule, JwtAuthGuard } from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { MessagingModule } from '@icms/messaging';
import { RedisModule } from '@icms/redis';
import { User } from './users/user.entity';
import { AuditLog } from './audit/audit-log.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecoveryModule } from './recovery/recovery.module';
import { TwoFactorModule } from './twofa/twofa.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    SharedAuthModule,
    RedisModule,
    MessagingModule.forRoot(),
    DatabaseModule.forRoot({ database: 'icms_auth', entities: [User, AuditLog] }),
    AuthModule,
    UsersModule,
    RecoveryModule,
    TwoFactorModule,
    AuditModule,
  ],
  // JWT completo por defecto; los endpoints públicos usan @Public().
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
