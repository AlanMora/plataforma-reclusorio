/**
 * Validación y tipado de variables de entorno. Se usa como `validate` en el
 * `ConfigModule.forRoot` de cada servicio para fallar rápido ante configuración
 * inválida.
 */
export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  LOG_LEVEL: string;
  JWT_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  JWT_ISSUER: string;
}

export function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Valida las variables mínimas requeridas por cualquier servicio.
 * Lanza si falta una variable crítica en producción.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = (config.NODE_ENV as string) ?? 'development';

  if (nodeEnv === 'production' && !config.JWT_SECRET) {
    throw new Error('JWT_SECRET es obligatorio en producción');
  }

  return config;
}
