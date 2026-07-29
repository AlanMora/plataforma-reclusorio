import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { parseNumber } from '@icms/config';

export interface DatabaseModuleOptions {
  /** Nombre de la base de datos propia del servicio (database-per-service). */
  database: string;
  /** Entidades del servicio a registrar. */
  entities: EntityClassOrSchema[];
  /** Sincronizar el esquema automáticamente (sólo desarrollo). */
  synchronize?: boolean;
  /** Rutas glob a las migraciones del servicio. En producción se corren al arrancar. */
  migrations?: string[];
}

/**
 * Módulo de base de datos con **replicación**: las escrituras van al primary y
 * las lecturas se reparten a la réplica. `reporting-service` se beneficia
 * directamente consumiendo la réplica de lectura.
 */
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres' as const,
            replication: {
              master: {
                host: config.get<string>('POSTGRES_HOST', 'localhost'),
                port: parseNumber(config.get<string>('POSTGRES_PORT'), 5432),
                username: config.get<string>('POSTGRES_USER', 'icms'),
                password: config.get<string>('POSTGRES_PASSWORD', 'icms'),
                database: options.database,
              },
              slaves: [
                {
                  host: config.get<string>('POSTGRES_REPLICA_HOST', 'localhost'),
                  port: parseNumber(config.get<string>('POSTGRES_REPLICA_PORT'), 5433),
                  username: config.get<string>('POSTGRES_USER', 'icms'),
                  password: config.get<string>('POSTGRES_PASSWORD', 'icms'),
                  database: options.database,
                },
              ],
            },
            entities: options.entities,
            // synchronize SOLO en desarrollo; en producción se usan migraciones
            // versionadas (estrategia expand-migrate-contract, §5.1).
            synchronize:
              options.synchronize ?? config.get<string>('NODE_ENV') !== 'production',
            migrations: options.migrations ?? [],
            // Las migraciones se corren con la CLI en el pipeline (no al arrancar,
            // porque el bundle de webpack no incluye los archivos de migración).
            migrationsRun: false,
            autoLoadEntities: true,
            logging: config.get<string>('LOG_LEVEL') === 'debug',
          }),
        }),
      ],
    };
  }

  /** Registra entidades para inyección de repositorios en un módulo de feature. */
  static forFeature(entities: EntityClassOrSchema[]): DynamicModule {
    return TypeOrmModule.forFeature(entities);
  }
}
