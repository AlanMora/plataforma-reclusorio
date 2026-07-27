import { Injectable, Logger, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { USER_ID_HEADER } from '@icms/common';

/**
 * Validación **preliminar** del JWT en el borde. El gateway sólo verifica firma
 * y expiración (no autoriza por roles/permisos: eso lo hace cada servicio con la
 * validación completa). Si el token es válido, propaga el id de usuario a los
 * servicios internos vía cabecera.
 *
 * Las rutas públicas (login, refresh, recuperación, health) se excluyen en el
 * AppModule y no pasan por este middleware.
 */
@Injectable()
export class JwtPreValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtPreValidationMiddleware.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET', 'change-me-in-production'),
        issuer: this.config.get<string>('JWT_ISSUER', 'icms-platform'),
      });
      if (payload?.sub) {
        req.headers[USER_ID_HEADER] = String(payload.sub);
      }
      next();
    } catch (err) {
      this.logger.debug(`JWT preliminar inválido: ${(err as Error).message}`);
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }
  }
}
