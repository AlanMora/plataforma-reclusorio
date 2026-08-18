import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

function conBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Adjunta el Bearer y, ante 401 o 403 con sesión viva, intenta UN refresh
 * (rotación RF-SES-005) y reintenta la petición. El 403 se reintenta porque
 * cambiar permisos ya NO revoca sesiones: el access token puede quedarse
 * hasta 10 min sin los permisos recién otorgados, y el refresh los relee de
 * la base. Si el refresh falla tras un 401, la sesión ya no es recuperable:
 * logout forzado (RF-SES-002/007); tras un 403 solo se propaga el error.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const esPublica = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
  const token = auth.tokens()?.accessToken;
  const solicitud = token && !esPublica ? conBearer(req, token) : req;

  return next(solicitud).pipe(
    catchError((err: unknown) => {
      const estado = err instanceof HttpErrorResponse ? err.status : 0;
      const es401 = estado === 401;
      if ((!es401 && estado !== 403) || esPublica || !auth.tokens()) {
        return throwError(() => err);
      }

      return from(
        auth.refrescar().catch(() => {
          if (es401) auth.forzarLogout('Tu sesión expiró. Inicia sesión nuevamente.');
          throw err;
        }),
        // El reintento NO vuelve a caer en este catchError: si el 403 persiste
        // con token fresco, el permiso de verdad no está otorgado y se propaga.
      ).pipe(switchMap((nuevo) => next(conBearer(req, nuevo))));
    }),
  );
};
