import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

/**
 * Endpoints de salud estándar (sin versión ni prefijo `/api`, para que balanceadores
 * y healthchecks de Docker los alcancen en una ruta fija):
 *  - `GET /health`        liveness (¿el proceso responde?)
 *  - `GET /health/ready`  readiness (¿dependencias listas?)
 */
@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([]);
  }
}
