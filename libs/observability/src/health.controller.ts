import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

/**
 * Endpoints de salud estándar:
 *  - `GET /health`        liveness (¿el proceso responde?)
 *  - `GET /health/ready`  readiness (¿dependencias listas?)
 *
 * Cada servicio puede extender la lista de indicadores (DB, Redis, broker).
 */
@ApiTags('health')
@Controller('health')
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
