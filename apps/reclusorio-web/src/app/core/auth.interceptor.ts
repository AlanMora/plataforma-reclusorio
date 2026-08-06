import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

function conBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Adjunta el Bearer y, ante 401 con sesión viva, intenta UN refresh
 * (rotación RF-SES-005) y reintenta la petición. Si el refresh falla,
 * la sesión ya no es recuperable: logout forzado (RF-SES-002/007).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const esPublica = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
  const token = auth.tokens()?.accessToken;
  const solicitud = token && !esPublica ? conBearer(req, token) : req;

  return next(solicitud).pipe(
    catchError((err: unknown) => {
      const es401 = err instanceof HttpErrorResponse && err.status === 401;
      if (!es401 || esPublica || !auth.tokens()) return throwError(() => err);

      return from(
        auth.refrescar().catch(() => {
          auth.forzarLogout('Tu sesión expiró. Inicia sesión nuevamente.');
          throw err;
        }),
      ).pipe(switchMap((nuevo) => next(conBearer(req, nuevo))));
    }),
  );
};
