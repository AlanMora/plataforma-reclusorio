import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

/** RF-UI: el layout privado solo es accesible con sesión iniciada. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.autenticado() ? true : router.createUrlTree(['/login']);
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
  const permiso = route.data['permiso'] as string | undefined;
  if (!permiso || auth.tiene(permiso)) return true;
  toast.error(`No tienes el permiso "${permiso}" para entrar a esta sección.`);
  return router.createUrlTree(['/']);
};
