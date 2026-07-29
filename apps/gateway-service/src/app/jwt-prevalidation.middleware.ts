import { Injectable, Logger, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { USER_ID_HEADER } from '@icms/common';
import { verifyAccessToken } from '@icms/auth';

/**
 * Validación **preliminar** del JWT en el borde. Verifica firma, expiración e
 * issuer (RS256 vía JWKS si `JWKS_URI` está definido; si no, HS256). No autoriza
 * por roles/permisos: eso lo hace cada servicio con la validación completa.
 * Propaga el id de usuario a los servicios internos.
 */
@Injectable()
export class JwtPreValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtPreValidationMiddleware.name);

  constructor(private readonly config: ConfigService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = await verifyAccessToken(token, this.config);
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
