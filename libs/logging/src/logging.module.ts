import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CORRELATION_ID_HEADER, CORRELATION_ID_KEY } from '@icms/common';
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
        // No loguear el ruido operativo: scrapes de Prometheus y health checks
        // llegan cada pocos segundos y ahogan los logs de negocio.
        autoLogging: {
          ignore: (req: IncomingMessage) => {
            const url = (req as { url?: string }).url ?? '';
            return (
              url === '/metrics' || url === '/health' || url.startsWith('/health/')
            );
          },
        },
        genReqId: (req: IncomingMessage) =>
          (req.headers[CORRELATION_ID_HEADER] as string) ?? randomUUID(),
        // Se evalúa también al terminar la respuesta: para entonces el guard JWT
        // ya dejó `req.user`, así cada línea dice QUIÉN hizo la petición.
        customProps: (req: IncomingMessage) => {
          const user = (req as { user?: { id?: string; username?: string } }).user;
          return {
            // El gateway genera el id (no llega en el header): se toma del request.
            correlationId:
              req.headers[CORRELATION_ID_HEADER] ??
              (req as unknown as Record<string, unknown>)[CORRELATION_ID_KEY],
            ...(user?.id ? { userId: user.id } : {}),
            ...(user?.username ? { username: user.username } : {}),
          };
        },
        serializers: {
          req: (req: IncomingMessage & { raw?: unknown }) => ({
            method: (req as any).method,
            url: (req as any).url,
          }),
          res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        },
        // Logs en JSON a stdout (ideal para Loki/observabilidad y robusto al
        // empaquetado con webpack). Para logs legibles en desarrollo, pipea la
        // salida por pino-pretty:  npx nx serve auth-service | npx pino-pretty
      },
    }),
  ],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
