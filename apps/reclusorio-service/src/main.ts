import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { configureApp } from '@icms/common';
import { initTracing } from '@icms/observability';
import { AppModule } from './app/app.module';

/**
 * reclusorio-service — servicio de dominio de la Plataforma de Gestión de
 * Reclusorio. Implementa el Modelo de Datos Consolidado (fuente de verdad)
 * y la Especificación de Requerimientos Funcionales v1.0.
 */
async function bootstrap() {
  await initTracing('reclusorio-service');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  configureApp(app, {
    serviceName: 'reclusorio-service',
    description:
      'Dominio del reclusorio: personas, elementos, actividades, incidencias, archivos y catálogos',
  });

  const port = Number(process.env.RECLUSORIO_PORT ?? 3010);
  await app.listen(port);
  new Logger('reclusorio-service').log(`🏛️ reclusorio-service en http://localhost:${port}/api`);
}

bootstrap();
