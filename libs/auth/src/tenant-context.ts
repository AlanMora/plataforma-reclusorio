import { AsyncLocalStorage } from 'node:async_hooks';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedUser, OrgScope } from './jwt-payload.interface';

/** Datos del contexto de la petición, disponibles en cualquier capa sin propagarlos a mano. */
export interface RequestContext {
  userId?: string;
  tenantId?: string;
  organizationalUnitIds: string[];
  scope: OrgScope;
  correlationId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Contexto multi-tenant por petición (AsyncLocalStorage). Los repositorios,
 * publicadores de eventos y logs pueden leer el tenant/OU actuales sin recibirlos
 * como parámetro en cada método.
 */
export const TenantContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  tenantId(): string | undefined {
    return storage.getStore()?.tenantId;
  },
  userId(): string | undefined {
    return storage.getStore()?.userId;
  },
};

/**
 * Puebla el contexto desde `request.user` (ya validado por JwtAuthGuard) y el
 * correlationId, y ejecuta el resto del pipeline dentro de ese contexto.
 * Registrar como APP_INTERCEPTOR después del guard de autenticación.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;
    const ctx: RequestContext = {
      userId: user?.id,
      tenantId: user?.tenantId,
      organizationalUnitIds: user?.organizationalUnitIds ?? [],
      scope: user?.scope ?? 'own_ou',
      correlationId: req.correlationId,
    };
    return new Observable((subscriber) => {
      TenantContext.run(ctx, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
