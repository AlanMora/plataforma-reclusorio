import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente ligero de feature flags. En el andamiaje resuelve flags desde
 * variables de entorno (`FEATURE_<NAME>=true`). En un despliegue real debería
 * consultar al `configuration-service` (módulo de catálogos/flags) y cachear
 * en Redis.
 */
@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly cache = new Map<string, boolean>();

  isEnabled(flag: string, defaultValue = false): boolean {
    if (this.cache.has(flag)) {
      return this.cache.get(flag)!;
    }
    const envKey = `FEATURE_${flag.toUpperCase().replace(/[.-]/g, '_')}`;
    const raw = process.env[envKey];
    const value = raw === undefined ? defaultValue : ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
    this.cache.set(flag, value);
    return value;
  }

  /** Invalida la caché local (p.ej. tras una publicación de configuración). */
  invalidate(flag?: string): void {
    if (flag) {
      this.cache.delete(flag);
    } else {
      this.cache.clear();
    }
    this.logger.debug(`Feature flags cache invalidada${flag ? `: ${flag}` : ''}`);
  }
}
