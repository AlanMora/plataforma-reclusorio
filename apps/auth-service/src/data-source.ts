import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * DataSource para la CLI de TypeORM (generar/correr migraciones).
 * Uso:
 *   pnpm migration:generate apps/auth-service/src/migrations/Init -d apps/auth-service/src/data-source.ts
 *   pnpm migration:run -d apps/auth-service/src/data-source.ts
 *
 * Las entidades se cargan por glob (incluye las del servicio y las compartidas
 * de Outbox/Inbox) para evitar imports relativos bajo el loader de la CLI.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'icms',
  password: process.env.POSTGRES_PASSWORD ?? 'icms',
  database: process.env.POSTGRES_DB ?? 'icms_auth',
  entities: [
    'apps/auth-service/src/**/*.entity.ts',
    'libs/messaging/src/outbox/outbox.entities.ts',
  ],
  migrations: ['apps/auth-service/src/migrations/*.ts'],
});
