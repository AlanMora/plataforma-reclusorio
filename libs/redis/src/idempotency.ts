import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type Redis from 'ioredis';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { REDIS_CLIENT } from './redis.module';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Marca un handler como idempotente. El cliente debe enviar la cabecera
 * `Idempotency-Key`; reintentos con la misma clave devuelven la respuesta original
 * en lugar de ejecutar la operación de nuevo (§7.1, §12.2).
 */
export const Idempotent = (ttlSeconds = 86400) => SetMetadata(IDEMPOTENT_KEY, ttlSeconds);

interface StoredResult {
  status: 'processing' | 'done';
  body?: unknown;
}

/**
 * Interceptor de idempotencia respaldado en Redis. Registrar como APP_INTERCEPTOR;
 * solo actúa en handlers anotados con `@Idempotent()`.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const ttl = this.reflector.getAllAndOverride<number>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!ttl) return next.handle();

    const req = context.switchToHttp().getRequest();
    const idemKey = req.headers['idempotency-key'];
    if (!idemKey) {
      throw new ConflictException('Falta la cabecera Idempotency-Key');
    }

    const tenant = req.user?.tenantId ?? 'public';
    const redisKey = `idem:${tenant}:${req.method}:${req.baseUrl ?? ''}${req.path}:${idemKey}`;

    const existing = await this.redis.get(redisKey);
    if (existing) {
      const parsed = JSON.parse(existing) as StoredResult;
      if (parsed.status === 'processing') {
        throw new ConflictException('Operación con esa Idempotency-Key aún en curso');
      }
      return of(parsed.body); // replay de la respuesta original
    }

    // Reserva la clave (NX) marcando "en proceso" con TTL corto.
    await this.redis.set(redisKey, JSON.stringify({ status: 'processing' }), 'EX', 120, 'NX');

    return next.handle().pipe(
      tap((body) => {
        this.redis
          .set(redisKey, JSON.stringify({ status: 'done', body } satisfies StoredResult), 'EX', ttl)
          .catch(() => undefined);
      }),
    );
  }
}
