import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';

/**
 * Gestiona el par de claves RSA para firmar access tokens (RS256) y publicar la
 * clave pública vía JWKS (§4.2). En producción se cargan de `JWT_PRIVATE_KEY` /
 * `JWT_PUBLIC_KEY` (PEM); en desarrollo se genera un par efímero.
 */
@Injectable()
export class KeyService {
  private readonly logger = new Logger(KeyService.name);
  readonly algorithm = 'RS256' as const;
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
  readonly kid: string;
  private readonly jwk: Record<string, unknown>;

  constructor(config: ConfigService) {
    const priv = config.get<string>('JWT_PRIVATE_KEY');
    const pub = config.get<string>('JWT_PUBLIC_KEY');

    if (priv && pub) {
      this.privateKeyPem = priv.replace(/\\n/g, '\n');
      this.publicKeyPem = pub.replace(/\\n/g, '\n');
    } else {
      const pair = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      this.privateKeyPem = pair.privateKey;
      this.publicKeyPem = pair.publicKey;
      this.logger.warn(
        'Clave RSA EFÍMERA generada. Define JWT_PRIVATE_KEY/JWT_PUBLIC_KEY (PEM) en producción.',
      );
    }

    const jwk = createPublicKey(this.publicKeyPem).export({ format: 'jwk' }) as Record<string, string>;
    this.kid = createHash('sha256').update(jwk.n ?? '').digest('hex').slice(0, 16);
    this.jwk = { ...jwk, kid: this.kid, use: 'sig', alg: 'RS256' };
  }

  /** Documento JWKS público. */
  jwks(): { keys: Record<string, unknown>[] } {
    return { keys: [this.jwk] };
  }
}
