import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenDomainException } from '@icms/common';
import { PermissionsGuard, RolesGuard } from './guards';

const ctx = (user: unknown): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const reflectorWith = (value: unknown): Reflector =>
  ({ getAllAndOverride: () => value }) as unknown as Reflector;

describe('RolesGuard', () => {
  it('permite cuando no se requieren roles', () => {
    expect(new RolesGuard(reflectorWith(undefined)).canActivate(ctx({ roles: [] }))).toBe(true);
  });

  it('permite cuando el usuario tiene el rol requerido', () => {
    expect(new RolesGuard(reflectorWith(['admin'])).canActivate(ctx({ roles: ['admin'] }))).toBe(true);
  });

  it('rechaza cuando falta el rol', () => {
    expect(() => new RolesGuard(reflectorWith(['admin'])).canActivate(ctx({ roles: ['user'] }))).toThrow(
      ForbiddenDomainException,
    );
  });
});

describe('PermissionsGuard', () => {
  it('exige TODOS los permisos', () => {
    expect(() =>
      new PermissionsGuard(reflectorWith(['a', 'b'])).canActivate(ctx({ permissions: ['a'] })),
    ).toThrow(ForbiddenDomainException);
    expect(
      new PermissionsGuard(reflectorWith(['a'])).canActivate(ctx({ permissions: ['a', 'b'] })),
    ).toBe(true);
  });
});
