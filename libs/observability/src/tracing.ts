import { Logger } from '@nestjs/common';

/**
 * Inicializa OpenTelemetry (§8.3). Se activa SOLO si `OTEL_EXPORTER_OTLP_ENDPOINT`
 * está definido; en su defecto es no-op (útil en local/tests).
 *
 * Debe invocarse lo antes posible en el arranque (idealmente antes de crear la
 * app Nest) para que las auto-instrumentaciones puedan parchear http/express/pg/
 * ioredis. Exporta trazas por OTLP/HTTP a un colector (p.ej. Tempo/Jaeger).
 *
 * Nota: con el bundle de webpack, para máxima cobertura de instrumentación se
 * recomienda además `NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"`.
 */
let started = false;

export async function initTracing(serviceName: string): Promise<void> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || started) return;
  started = true;

  process.env.OTEL_SERVICE_NAME ??= serviceName;

  // Import dinámico para no cargar el SDK cuando el tracing está desactivado.
  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  new Logger('Tracing').log(`OpenTelemetry activo para ${serviceName} -> ${endpoint}`);

  process.on('SIGTERM', () => void sdk.shutdown().catch(() => undefined));
}
