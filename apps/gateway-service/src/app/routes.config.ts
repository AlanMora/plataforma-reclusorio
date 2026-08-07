import { ConfigService } from '@nestjs/config';

export interface UpstreamRoute {
  /** Prefijo público que atiende el gateway. */
  prefix: string;
  /** Variable de entorno con la URL del servicio interno destino. */
  envKey: string;
  /** URL por defecto si la variable no está definida. */
  fallback: string;
  /** true = requiere JWT preliminar; false = ruta pública (login, etc.). */
  protected: boolean;
}

/**
 * Tabla de enrutado del gateway. Cada prefijo se reenvía a un servicio interno.
 * El gateway NO contiene lógica de negocio: sólo enruta, protege y observa.
 */
export const UPSTREAM_ROUTES: UpstreamRoute[] = [
  // auth: login/refresh/recuperación son públicos (no requieren token previo)
  { prefix: '/api/v1/auth', envKey: 'AUTH_SERVICE_URL', fallback: 'http://localhost:3001', protected: false },
  // perfil y listado de usuarios viven en auth-service (GET /users/me para RF-CUE-001)
  { prefix: '/api/v1/users', envKey: 'AUTH_SERVICE_URL', fallback: 'http://localhost:3001', protected: true },
  { prefix: '/api/v1/configuration', envKey: 'CONFIGURATION_SERVICE_URL', fallback: 'http://localhost:3002', protected: true },
  { prefix: '/api/v1/core', envKey: 'CORE_DOMAIN_SERVICE_URL', fallback: 'http://localhost:3003', protected: true },
  { prefix: '/api/v1/reporting', envKey: 'REPORTING_SERVICE_URL', fallback: 'http://localhost:3004', protected: true },
  { prefix: '/api/v1/notifications', envKey: 'NOTIFICATION_SERVICE_URL', fallback: 'http://localhost:3005', protected: true },
  { prefix: '/api/v1/integration', envKey: 'INTEGRATION_SERVICE_URL', fallback: 'http://localhost:3006', protected: true },
  { prefix: '/api/v1/files', envKey: 'FILE_SERVICE_URL', fallback: 'http://localhost:3007', protected: true },
  { prefix: '/api/v1/realtime', envKey: 'REALTIME_SERVICE_URL', fallback: 'http://localhost:3009', protected: true },
  // reclusorio-service: dominio completo (F10 — el frontend entra por el gateway)
  { prefix: '/api/v1/personas', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
  { prefix: '/api/v1/elementos', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
  { prefix: '/api/v1/catalogos', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
  { prefix: '/api/v1/incidencias', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
  { prefix: '/api/v1/archivos', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
  { prefix: '/api/v1/audiencias', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
  { prefix: '/api/v1/traslados', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
  { prefix: '/api/v1/ingresos-egresos', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
  { prefix: '/api/v1/movimientos', envKey: 'RECLUSORIO_SERVICE_URL', fallback: 'http://localhost:3010', protected: true },
];

export function resolveTarget(route: UpstreamRoute, config: ConfigService): string {
  return config.get<string>(route.envKey, route.fallback);
}
