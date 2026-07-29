import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CORRELATION_ID_KEY } from '../constants';
import { ApiResponse } from '../dto/api-response.dto';

/**
 * Envuelve las respuestas exitosas en el sobre `ApiResponse`. Si el controlador
 * ya devolvió un `ApiResponse`, se respeta tal cual.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = (request as any)[CORRELATION_ID_KEY];

    // /metrics (texto Prometheus) y /.well-known/jwks.json (JSON estándar) se
    // devuelven crudos, sin el sobre ApiResponse.
    const path = ((request as any)?.path ?? (request as any)?.url ?? '').split('?')[0];
    if (path === '/metrics' || path === '/.well-known/jwks.json') {
      return next.handle() as unknown as Observable<ApiResponse<T>>;
    }

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in (data as object)) {
          return data as unknown as ApiResponse<T>;
        }
        return ApiResponse.ok(data, correlationId);
      }),
    );
  }
}
