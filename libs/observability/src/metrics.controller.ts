import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { register } from 'prom-client';

/**
 * Controlador de métricas Prometheus **version-neutral**, expuesto en `/metrics`
 * (sin `/api` ni `/v1`) para que Prometheus lo scrappee en una ruta fija. Se pasa
 * como `controller` a `PrometheusModule` en lugar del controlador por defecto,
 * que quedaría versionado bajo `/v1/metrics`.
 */
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  @Get()
  async index(@Res({ passthrough: true }) res: { header: (k: string, v: string) => void }): Promise<string> {
    res.header('Content-Type', register.contentType);
    return register.metrics();
  }
}
