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
import { ENTIDADES_RECLUSORIO } from './entities';
import { CatalogosModule } from './catalogos/catalogos.module';
import { PersonasModule } from './personas/personas.module';
import { ElementosModule } from './elementos/elementos.module';
import { IngresosMovimientosModule } from './actividades/ingresos-movimientos.module';
import { AudienciasTrasladosModule } from './actividades/audiencias-traslados.module';
import { IncidenciasModule } from './incidencias/incidencias.module';
import { ArchivosModule } from './archivos/archivos.module';
import { CatalogSeederService } from './seeds/seeder.service';
import { Init1786043245489 } from '../migrations/1786043245489-Init';

/**
 * Servicio de dominio de la Plataforma de Gestión de Reclusorio.
 * Base de datos propia (`reclusorio`) con el esquema EXACTO del Modelo de
 * Datos Consolidado. La seguridad (JWT/JWKS), permisos, idempotencia y
 * errores RFC 9457 vienen de la plataforma base.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    SharedAuthModule,
    RedisModule,
    MessagingModule.forRoot(),
    DatabaseModule.forRoot({
      database: 'reclusorio',
      entities: [...ENTIDADES_RECLUSORIO, OutboxEvent, InboxEvent],
      // Como clase importada para que webpack la incluya en el bundle; en
      // producción se ejecuta al arrancar (en dev el esquema lo crea synchronize).
      migrations: [Init1786043245489],
    }),
    OutboxModule.forRoot({ withRelay: true }),
    CatalogosModule,
    PersonasModule,
    ElementosModule,
    IngresosMovimientosModule,
    AudienciasTrasladosModule,
    IncidenciasModule,
    ArchivosModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RF-SEG-002: los permisos se verifican SIEMPRE en el backend.
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    CatalogSeederService,
  ],
})
export class AppModule {}
