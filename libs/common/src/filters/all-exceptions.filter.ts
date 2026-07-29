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
import { PROBLEM_JSON_CONTENT_TYPE, ProblemDetails } from '../exceptions/problem-details';

/**
 * Filtro global que normaliza CUALQUIER excepción a **RFC 9457
 * (application/problem+json)**. Se registra en el bootstrap de cada servicio y
 * en el gateway, garantizando errores consistentes en toda la plataforma.
 *
 * El tipo del problema usa `PROBLEM_TYPE_BASE` (URI base) si está definido; en
 * su defecto, `about:blank` como indica el RFC.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly typeBase = process.env.PROBLEM_TYPE_BASE?.replace(/\/$/, '');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request as any)[CORRELATION_ID_KEY];

    const problem = this.toProblem(exception, request, correlationId);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${problem.status}: ${problem.detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} -> ${problem.status}: ${problem.code}`,
      );
    }

    response.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  }

  private toProblem(exception: unknown, request: Request, correlationId?: string): ProblemDetails {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let detail = 'Ocurrió un error interno inesperado';
    let errors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = this.codeFromStatus(status);
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        code = (body.code as string) ?? code;
        detail = this.extractMessage(body) ?? exception.message;
        errors = body.details ?? (Array.isArray(body.message) ? body.message : undefined);
      } else {
        detail = String(res);
      }
    }

    return {
      type: this.typeFor(code),
      title: this.titleFromStatus(status),
      status,
      detail,
      instance: request.originalUrl ?? request.url,
      correlationId,
      code,
      ...(errors !== undefined ? { errors } : {}),
    };
  }

  private typeFor(code: string): string {
    if (!this.typeBase) return 'about:blank';
    const slug = code.toLowerCase().replace(/_/g, '-');
    return `${this.typeBase}/problems/${slug}`;
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

  private titleFromStatus(status: number): string {
    const name = HttpStatus[status];
    return name ? name.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'Error';
  }
}
