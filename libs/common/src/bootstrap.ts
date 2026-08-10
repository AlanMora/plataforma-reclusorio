import { INestApplication, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { fabricaErroresValidacion } from './validation/mensajes-validacion';

export interface BootstrapOptions {
  /** Nombre legible del servicio (usado en Swagger). */
  serviceName: string;
  /** Descripción corta del servicio para la documentación. */
  description?: string;
  /** Prefijo global de rutas (por defecto "api"). */
  globalPrefix?: string;
  /** Habilita Swagger en `/{globalPrefix}/docs` (por defecto true). */
  enableSwagger?: boolean;
  /** Habilita CORS (útil para el gateway). */
  enableCors?: boolean;
}

/**
 * Configuración transversal compartida por todos los servicios: validación,
 * versionado, filtro de errores normalizado, interceptor de respuesta y Swagger.
 * Mantiene el `main.ts` de cada servicio mínimo y consistente.
 */
export function configureApp(app: INestApplication, options: BootstrapOptions): void {
  const globalPrefix = options.globalPrefix ?? 'api';

  app.setGlobalPrefix(globalPrefix, {
    exclude: ['health', 'health/ready', 'metrics', '.well-known/jwks.json'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  if (options.enableCors) {
    app.enableCors();
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: fabricaErroresValidacion,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  if (options.enableSwagger !== false) {
    const config = new DocumentBuilder()
      .setTitle(`ICMS · ${options.serviceName}`)
      .setDescription(options.description ?? `API de ${options.serviceName}`)
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }
}

/** Registra un log estándar de arranque. */
export function logStartup(serviceName: string, port: number, globalPrefix = 'api'): void {
  const logger = new Logger(serviceName);
  logger.log(`🚀 ${serviceName} escuchando en http://localhost:${port}/${globalPrefix}`);
  logger.log(`📚 Swagger disponible en http://localhost:${port}/${globalPrefix}/docs`);
}
