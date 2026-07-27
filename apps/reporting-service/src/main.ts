import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { configureApp } from '@icms/common';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  configureApp(app, {
    serviceName: 'reporting-service',
    description: 'Consultas pesadas y generación de documentos (PDF/Excel/CSV). Usa la réplica de lectura.',
  });

  const port = Number(process.env.REPORTING_PORT ?? 3004);
  await app.listen(port);
  new Logger('reporting-service').log(`📊 reporting-service en http://localhost:${port}/api`);
}

bootstrap();
