import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CORRELATION_ID_HEADER, CORRELATION_ID_KEY } from '@icms/common';

/**
 * Lee el `x-correlation-id` entrante (o genera uno nuevo), lo adjunta al request
 * y lo refleja en la respuesta. El logger (pino) lo recoge automáticamente para
 * correlacionar trazas a través de todos los servicios.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_ID_HEADER);
    const correlationId = incoming && incoming.trim().length > 0 ? incoming : randomUUID();

    (req as any)[CORRELATION_ID_KEY] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
