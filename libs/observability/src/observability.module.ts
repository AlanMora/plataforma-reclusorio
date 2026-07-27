import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { HealthController } from './health.controller';

/**
 * Módulo de observabilidad compartido: health checks (Terminus) y métricas
 * Prometheus expuestas en `GET /metrics`. Importándolo, cada servicio queda
 * listo para ser scrappeado por Prometheus y monitoreado por Grafana.
 */
@Module({
  imports: [
    TerminusModule,
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
  controllers: [HealthController],
})
export class ObservabilityModule {}
