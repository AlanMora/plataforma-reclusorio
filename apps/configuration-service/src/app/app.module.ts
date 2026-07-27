import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { SharedAuthModule, JwtAuthGuard, PermissionsGuard } from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { MessagingModule } from '@icms/messaging';
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
    MessagingModule.forRoot(),
    DatabaseModule.forRoot({
      database: 'icms_configuration',
      entities: [Institution, Branch, OperationalUser, Role, Permission, CatalogItem, Parameter],
    }),
    OrganizationModule,
    PermissionsModule,
    CatalogsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
