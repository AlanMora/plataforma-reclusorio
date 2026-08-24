import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetails } from './models';

/**
 * Manejo de errores RF-UI/RF-GEN-005: el backend responde RFC 9457
 * (application/problem+json) sin detalles internos; aquí se convierte
 * a un mensaje presentable.
 */
export function problemaDe(err: unknown): ProblemDetails {
  if (err instanceof HttpErrorResponse) {
    const cuerpo = err.error;
    if (cuerpo && typeof cuerpo === 'object' && ('detail' in cuerpo || 'title' in cuerpo)) {
      return cuerpo as ProblemDetails;
    }
    if (err.status === 0) {
      return { status: 0, detail: 'No hay conexión con el servidor. Verifica tu red.' };
    }
    return { status: err.status, detail: `Error ${err.status} del servidor` };
  }
  if (err instanceof Error) {
    return { detail: err.message || 'No fue posible completar la operación' };
  }
  if (err && typeof err === 'object' && ('detail' in err || 'title' in err)) {
    return err as ProblemDetails;
  }
  return { detail: 'Ocurrió un error inesperado' };
}

export function mensajeDe(err: unknown): string {
  const p = problemaDe(err);
  if (p.errors?.length) return p.errors.join(' · ');
  return p.detail || p.title || 'Ocurrió un error inesperado';
}
