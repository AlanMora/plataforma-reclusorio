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
import { Branch, Institution, OperationalUser } from './organization/organization.entities';
import { Permission, Role } from './permissions/permissions.module';
import { CatalogItem, Parameter } from './catalogs/catalogs.module';
import { OrganizationModule } from './organization/organization.module';
import { PermissionsModule } from './permissions/permissions.module';
import { CatalogsModule } from './catalogs/catalogs.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    SharedAuthModule,
    RedisModule,
    MessagingModule.forRoot(),
    DatabaseModule.forRoot({
      database: 'icms_configuration',
      entities: [Institution, Branch, OperationalUser, Role, Permission, CatalogItem, Parameter, OutboxEvent, InboxEvent],
    }),
    OutboxModule.forRoot({ withRelay: true }),
    OrganizationModule,
    PermissionsModule,
    CatalogsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
