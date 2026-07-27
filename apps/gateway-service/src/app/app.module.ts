import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type Redis from 'ioredis';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppConfigModule, parseNumber } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { RedisModule, REDIS_CLIENT } from '@icms/redis';
import { CORRELATION_ID_HEADER } from '@icms/common';
import { JwtPreValidationMiddleware } from './jwt-prevalidation.middleware';
import { UPSTREAM_ROUTES, resolveTarget } from './routes.config';

/**
 * Gateway: único punto público de entrada. Enruta a los servicios internos,
 * aplica rate limiting, valida el JWT de forma preliminar, propaga el
 * correlationId y normaliza errores. Sin lógica de negocio.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    RedisModule,
    JwtModule.register({}),
    // Rate limiting respaldado en Redis: el límite es GLOBAL entre todas las
    // réplicas del gateway (indispensable para balanceo de carga / Swarm).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redis: Redis) => ({
        throttlers: [
          {
            ttl: parseNumber(config.get<string>('RATE_LIMIT_TTL'), 60) * 1000,
            limit: parseNumber(config.get<string>('RATE_LIMIT_MAX'), 120),
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    // 1) Validación preliminar de JWT sólo en rutas protegidas.
    const protectedPrefixes = UPSTREAM_ROUTES.filter((r) => r.protected).map((r) => `${r.prefix}/*`);
    if (protectedPrefixes.length > 0) {
      consumer
        .apply(JwtPreValidationMiddleware)
        .forRoutes(...protectedPrefixes.map((path) => ({ path, method: RequestMethod.ALL })));
    }

    // 2) Proxy hacia cada servicio interno, propagando correlationId y user id.
    for (const route of UPSTREAM_ROUTES) {
      const target = resolveTarget(route, this.config);
      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        xfwd: true,
        on: {
          proxyReq: (proxyReq, req) => {
            const correlationId = (req as any).correlationId;
            if (correlationId) proxyReq.setHeader(CORRELATION_ID_HEADER, correlationId);
          },
        },
      });
      consumer.apply(proxy).forRoutes({ path: `${route.prefix}/*`, method: RequestMethod.ALL });
    }
  }
}
