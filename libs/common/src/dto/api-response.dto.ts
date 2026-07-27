/**
 * Sobre de respuesta uniforme para toda la plataforma.
 * Todas las respuestas (éxito o error) comparten esta forma para que los
 * consumidores tengan un contrato estable e independiente del servicio.
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiResponse<T = unknown> {
  success!: boolean;
  data?: T;
  error?: ApiError;
  correlationId?: string;
  timestamp!: string;

  static ok<T>(data: T, correlationId?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  static fail(error: ApiError, correlationId?: string): ApiResponse<never> {
    return {
      success: false,
      error,
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }
}
