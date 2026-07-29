/**
 * Problem Details for HTTP APIs — RFC 9457 (§7.4 del estándar).
 * Forma pública y uniforme de TODOS los errores de la plataforma.
 */
export interface ProblemDetails {
  /** URI que identifica el tipo de problema ('about:blank' si es genérico). */
  type: string;
  /** Resumen legible del tipo de problema. */
  title: string;
  /** Código HTTP. */
  status: number;
  /** Explicación específica de esta ocurrencia. */
  detail?: string;
  /** URI de la petición que produjo el error. */
  instance?: string;
  /** Extensión: id de correlación para trazar la operación. */
  correlationId?: string;
  /** Extensión: código de negocio estable (p.ej. BUSINESS_RULE_VIOLATION). */
  code?: string;
  /** Extensión: detalle de validación u otra información estructurada. */
  errors?: unknown;
}

export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';
