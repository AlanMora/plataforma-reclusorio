import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from './jwt-payload.interface';
import { buildJwtStrategyOptions } from './jwks';

/**
 * Estrategia JWT compartida. Cada servicio la registra para validar
 * COMPLETAMENTE el token (el gateway sólo hace una validación preliminar).
 * Valida RS256 vía JWKS si `JWKS_URI` está definido; si no, HS256 con secreto.
 * El objeto devuelto se inyecta en `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super(buildJwtStrategyOptions(config));
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      organizationalUnitIds: payload.ous ?? [],
      scope: payload.scope ?? 'own_ou',
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      sessionId: payload.sid,
    };
  }
}
