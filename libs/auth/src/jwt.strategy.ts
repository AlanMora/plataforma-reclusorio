import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from './jwt-payload.interface';

/**
 * Estrategia JWT compartida. Cada servicio la registra para validar
 * COMPLETAMENTE el token (el gateway sólo hace una validación preliminar).
 * El objeto devuelto se inyecta en `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'change-me-in-production'),
      issuer: config.get<string>('JWT_ISSUER', 'icms-platform'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      sessionId: payload.sid,
    };
  }
}
