import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@icms/auth';
import { KeyService } from './key.service';

/**
 * Publica las claves públicas para validar los access tokens RS256 (JWKS, §4.2).
 * Ruta estándar y sin versión: `GET /.well-known/jwks.json`.
 */
@ApiTags('jwks')
@Controller({ path: '.well-known/jwks.json', version: VERSION_NEUTRAL })
export class JwksController {
  constructor(private readonly keys: KeyService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'JWKS: claves públicas para validar access tokens' })
  jwks() {
    return this.keys.jwks();
  }
}
