import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { parseNumber } from '@icms/config';

/**
 * Adaptador de Socket.IO respaldado por Redis (pub/sub) para permitir el
 * **escalado horizontal**: los eventos emitidos por una instancia llegan a los
 * clientes conectados a cualquier otra instancia.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const config = this.app.get(ConfigService);
    const options = {
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: parseNumber(config.get<string>('REDIS_PORT'), 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
    };

    const pubClient = new Redis(options);
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(`Adaptador Redis para WebSocket configurado (${options.host}:${options.port})`);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      (server as { adapter: (a: unknown) => void }).adapter(this.adapterConstructor);
    }
    return server;
  }
}
