import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import { parseNumber } from '@icms/config';

/** Token de inyección del cliente ioredis compartido. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Módulo Redis compartido: expone un único cliente ioredis (token `REDIS_CLIENT`)
 * configurado por entorno. Lo usan el rate limiting del gateway, el store de
 * sesiones de auth, los locks del scheduler y el adaptador de realtime.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: parseNumber(config.get<string>('REDIS_PORT'), 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null,
          lazyConnect: false,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT, { strict: false });
    await client?.quit().catch(() => undefined);
  }
}
