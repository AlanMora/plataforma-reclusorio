import { ConfigService } from '@nestjs/config';
import { ExtractJwt, StrategyOptions } from 'passport-jwt';
import { JwksClient, passportJwtSecret } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';

/**
 * Construye las opciones de la estrategia passport-jwt en modo dual:
 *  - Si `JWKS_URI` está definido → valida RS256 con claves públicas de JWKS
 *    (recomendado por el estándar §4.2/§6.1).
 *  - En su defecto → valida HS256 con `JWT_SECRET` (fallback para desarrollo).
 */
export function buildJwtStrategyOptions(config: ConfigService): StrategyOptions {
  const jwksUri = config.get<string>('JWKS_URI');
  const issuer = config.get<string>('JWT_ISSUER', 'icms-platform');
  const base = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    issuer,
  };

  if (jwksUri) {
    return {
      ...base,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
    } as StrategyOptions;
  }

  return {
    ...base,
    algorithms: ['HS256'],
    secretOrKey: config.get<string>('JWT_SECRET', 'change-me-in-production'),
  } as StrategyOptions;
}

let cachedClient: JwksClient | undefined;

/**
 * Verifica un access token (usado por la validación preliminar del gateway).
 * Mismo modo dual que la estrategia: RS256 vía JWKS o HS256 con secreto.
 */
export function verifyAccessToken(
  token: string,
  config: ConfigService,
): Promise<jwt.JwtPayload> {
  const jwksUri = config.get<string>('JWKS_URI');
  const issuer = config.get<string>('JWT_ISSUER', 'icms-platform');

  if (jwksUri) {
    const client = (cachedClient ??= new JwksClient({ jwksUri, cache: true, rateLimit: true }));
    const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
      client
        .getSigningKey(header.kid)
        .then((key) => callback(null, key.getPublicKey()))
        .catch((err) => callback(err as Error));
    };
    return new Promise((resolve, reject) => {
      jwt.verify(token, getKey, { algorithms: ['RS256'], issuer }, (err, payload) => {
        if (err) reject(err);
        else resolve(payload as jwt.JwtPayload);
      });
    });
  }

  const secret = config.get<string>('JWT_SECRET', 'change-me-in-production');
  return Promise.resolve(jwt.verify(token, secret, { algorithms: ['HS256'], issuer }) as jwt.JwtPayload);
}
