import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { configureApp } from '@icms/common';
import { AppModule } from './app/app.module';

/**
 * core-domain-service es una PLANTILLA. Renómbrala por proyecto con
 * `pnpm rename:core <nuevo-nombre>` (ver tools/rename-core-domain.mjs).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  configureApp(app, {
    serviceName: 'core-domain-service',
    description: 'Plantilla del servicio principal de negocio (renómbrala por proyecto)',
  });

  const port = Number(process.env.CORE_DOMAIN_PORT ?? 3003);
  await app.listen(port);
  new Logger('core-domain-service').log(`🧩 core-domain-service en http://localhost:${port}/api`);
}

bootstrap();
