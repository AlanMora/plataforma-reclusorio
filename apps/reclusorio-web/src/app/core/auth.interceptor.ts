import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

function conBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Interceptor de autenticación:
 * - Adjunta el Bearer token a las solicitudes protegidas.
 * - Si una solicitud recibe 401 (No autorizado) o 403 (Prohibido):
 *   1. Si no hay tokens o falló el endpoint de refresh -> Redirige a /login.
 *   2. Si hay tokens -> Intenta refrescar la sesión (rotación RF-SES-005).
 *   3. Si el refresh falla o el reintento vuelve a ser 401 -> Fuerza cierre de sesión y redirige a /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const esLogin = req.url.includes('/auth/login');
  const esRefresh = req.url.includes('/auth/refresh');
  const token = auth.tokens()?.accessToken;
  const solicitud = token && !esLogin && !esRefresh ? conBearer(req, token) : req;

  return next(solicitud).pipe(
    catchError((err: unknown) => {
      const estado = err instanceof HttpErrorResponse ? err.status : 0;
      const es401 = estado === 401;

      // El error de login se propaga directamente al formulario de inicio de sesión
      if (esLogin) {
        return throwError(() => err);
      }

      // Si el endpoint de refresco falló, la sesión ya no es recuperable -> logout inmediato a login
      if (esRefresh) {
        auth.forzarLogout('Tu sesión expiró o fue cerrada. Inicia sesión nuevamente.');
        return throwError(() => err);
      }

      // Manejo de errores de autenticación / permisos (401 o 403)
      if (es401 || estado === 403) {
        // Si no tenemos tokens guardados y da 401 -> enviar a login
        if (!auth.tokens()?.refreshToken) {
          if (es401) {
            auth.forzarLogout('Inicia sesión para continuar.');
          }
          return throwError(() => err);
        }

        // Intentar renovar el token
        return from(
          auth.refrescar().catch((refreshErr) => {
            // Si el refresh falla, la sesión murió
            auth.forzarLogout('Tu sesión expiró. Inicia sesión nuevamente.');
            throw refreshErr;
          }),
        ).pipe(
          switchMap((nuevoToken) =>
            next(conBearer(req, nuevoToken)).pipe(
              catchError((retryErr: unknown) => {
                const retryStatus = retryErr instanceof HttpErrorResponse ? retryErr.status : 0;
                if (retryStatus === 401) {
                  auth.forzarLogout('Tu sesión no es válida. Inicia sesión nuevamente.');
                }
                return throwError(() => retryErr);
              }),
            ),
          ),
        );
      }

      return throwError(() => err);
    }),
  );
};
