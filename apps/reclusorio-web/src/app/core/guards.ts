import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { esJwtExpirado } from './token-store';

/** RF-UI: el layout privado solo es accesible con sesión iniciada y vigente. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.autenticado()) {
    return router.createUrlTree(['/login']);
  }

  const tokens = auth.tokens();
  if (!tokens?.refreshToken) {
    auth.forzarLogout('Inicia sesión para acceder.');
    return router.createUrlTree(['/login']);
  }

  // Si el access token ya expiró, intentamos refrescarlo antes de activar la ruta
  if (esJwtExpirado(tokens.accessToken)) {
    try {
      await auth.refrescar();
      return true;
    } catch {
      auth.forzarLogout('Tu sesión expiró. Inicia sesión nuevamente.');
      return router.createUrlTree(['/login']);
    }
  }

  return true;
};

/**
 * RF-SEG-001/002: cada ruta declara `data.permiso` ('modulo:accion').
 * La autoridad final sigue siendo el backend; esto solo evita mostrar
 * pantallas que responderían 403.
 */
export const permisoGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!auth.autenticado()) {
    return router.createUrlTree(['/login']);
  }

  const permiso = route.data['permiso'] as string | undefined;
  if (!permiso || auth.tiene(permiso)) return true;
  toast.error(`No tienes el permiso "${permiso}" para entrar a esta sección.`);
  return router.createUrlTree(['/']);
};
