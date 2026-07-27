import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { parseNumber } from '@icms/config';

/**
 * Lock distribuido sobre Redis (Redlock). Garantiza la **exclusión de
 * ejecuciones simultáneas**: sólo una instancia del scheduler ejecuta un job
 * dado a la vez, aunque haya múltiples réplicas.
 */
@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redis: Redis;
  private readonly redlock: Redlock;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: parseNumber(config.get<string>('REDIS_PORT'), 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.redlock = new Redlock([this.redis], { retryCount: 0 });
  }

  /** Ejecuta `fn` sólo si adquiere el lock; si no, omite la ejecución. */
  async runExclusive<T>(resource: string, ttlMs: number, fn: () => Promise<T>): Promise<T | undefined> {
    let lock: Lock | undefined;
    try {
      lock = await this.redlock.acquire([`locks:${resource}`], ttlMs);
    } catch {
      this.logger.debug(`Lock ocupado, se omite ejecución: ${resource}`);
      return undefined;
    }
    try {
      return await fn();
    } finally {
      await lock.release().catch(() => undefined);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
