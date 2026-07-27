import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CORRELATION_ID_KEY } from '../constants';
import { ApiError, ApiResponse } from '../dto/api-response.dto';

/**
 * Filtro global que normaliza CUALQUIER excepción al sobre de respuesta
 * uniforme `ApiResponse`. Se registra en el bootstrap de cada servicio y en
 * el gateway, garantizando errores consistentes en toda la plataforma.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request as any)[CORRELATION_ID_KEY];

    const { status, error } = this.normalize(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${status}: ${error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${correlationId}] ${request.method} ${request.url} -> ${status}: ${error.code}`);
    }

    response.status(status).json(ApiResponse.fail(error, correlationId));
  }

  private normalize(exception: unknown): { status: number; error: ApiError } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        return {
          status,
          error: {
            code: (body.code as string) ?? this.codeFromStatus(status),
            message: this.extractMessage(body) ?? exception.message,
            details: body.details,
          },
        };
      }

      return {
        status,
        error: { code: this.codeFromStatus(status), message: String(res) },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error interno inesperado',
      },
    };
  }

  private extractMessage(body: Record<string, unknown>): string | undefined {
    const message = body.message;
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
    return undefined;
  }

  private codeFromStatus(status: number): string {
    return HttpStatus[status] ?? `HTTP_${status}`;
  }
}
