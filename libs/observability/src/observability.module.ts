import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';

/**
 * Módulo de observabilidad compartido: health checks (Terminus) y métricas
 * Prometheus. Ambos se exponen en rutas fijas y sin versión (`/health`,
 * `/metrics`) para healthchecks y scraping.
 */
@Module({
  imports: [
    TerminusModule,
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      controller: MetricsController,
    }),
  ],
  controllers: [HealthController],
})
export class ObservabilityModule {}
