import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ForbiddenDomainException } from '@icms/common';
import { AuthenticatedUser } from './jwt-payload.interface';

/** Marca una ruta como pública (omite JwtAuthGuard). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Guard JWT que respeta el decorador `@Public()`. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

/** Autorización por roles. Úsese junto con `@Roles(...)`. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    const ok = !!user && required.some((role) => user.roles.includes(role));
    if (!ok) throw new ForbiddenDomainException('Rol insuficiente');
    return true;
  }
}

/** Autorización por permisos granulares. Úsese junto con `@RequirePermissions(...)`. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    const ok = !!user && required.every((perm) => user.permissions.includes(perm));
    if (!ok) throw new ForbiddenDomainException('Permiso insuficiente');
    return true;
  }
}

export const AUTH_GUARDS: Type<CanActivate>[] = [JwtAuthGuard, RolesGuard, PermissionsGuard];
