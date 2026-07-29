import 'reflect-metadata';
import { DataSource } from 'typeorm';

/** DataSource para la CLI de TypeORM (migraciones) de scheduler-service. */
export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'icms',
  password: process.env.POSTGRES_PASSWORD ?? 'icms',
  database: process.env.POSTGRES_DB ?? 'icms_scheduler',
  entities: ['apps/scheduler-service/src/**/*.entity.ts', 'libs/messaging/src/outbox/outbox.entities.ts'],
  migrations: ['apps/scheduler-service/src/migrations/*.ts'],
});
