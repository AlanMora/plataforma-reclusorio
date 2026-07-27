import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { parseNumber } from '@icms/config';

export interface DatabaseModuleOptions {
  /** Nombre de la base de datos propia del servicio (database-per-service). */
  database: string;
  /** Entidades del servicio a registrar. */
  entities: (new () => object)[] | Function[];
  /** Sincronizar el esquema automáticamente (sólo desarrollo). */
  synchronize?: boolean;
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
            synchronize:
              options.synchronize ?? config.get<string>('NODE_ENV') !== 'production',
            autoLoadEntities: true,
            logging: config.get<string>('LOG_LEVEL') === 'debug',
          }),
        }),
      ],
    };
  }

  /** Registra entidades para inyección de repositorios en un módulo de feature. */
  static forFeature(entities: Function[]): DynamicModule {
    return TypeOrmModule.forFeature(entities);
  }
}
