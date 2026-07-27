import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CORRELATION_ID_HEADER } from '@icms/common';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

/**
 * Módulo de logging estructurado basado en pino. Cada línea de log incluye el
 * `correlationId` de la petición. En desarrollo usa `pino-pretty`; en producción
 * emite JSON apto para Loki/observabilidad.
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req: IncomingMessage) =>
          (req.headers[CORRELATION_ID_HEADER] as string) ?? randomUUID(),
        customProps: (req: IncomingMessage) => ({
          correlationId: req.headers[CORRELATION_ID_HEADER],
        }),
        serializers: {
          req: (req: IncomingMessage & { raw?: unknown }) => ({
            method: (req as any).method,
            url: (req as any).url,
          }),
          res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
  ],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
