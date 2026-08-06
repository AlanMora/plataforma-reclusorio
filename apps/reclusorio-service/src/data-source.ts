import 'reflect-metadata';
import { DataSource } from 'typeorm';

/** DataSource para la CLI de TypeORM (migraciones) de reclusorio-service. */
export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'icms',
  password: process.env.POSTGRES_PASSWORD ?? 'icms',
  database: process.env.POSTGRES_DB ?? 'reclusorio',
  entities: [
    'apps/reclusorio-service/src/app/entities/*.entities.ts',
    'apps/reclusorio-service/src/app/entities/*.entity.ts',
    'libs/messaging/src/outbox/outbox.entities.ts',
  ],
  migrations: ['apps/reclusorio-service/src/migrations/*.ts'],
});
