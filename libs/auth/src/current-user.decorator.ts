import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './jwt-payload.interface';

/**
 * Inyecta el usuario autenticado (o una de sus propiedades) en un handler.
 *   `@CurrentUser() user: AuthenticatedUser`
 *   `@CurrentUser('id') userId: string`
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    return data && user ? user[data] : user;
  },
);
