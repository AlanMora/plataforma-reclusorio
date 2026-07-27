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
    serviceName: 'configuration-service',
    description: 'Organización, permisos y catálogos; parámetros y feature flags',
  });

  const port = Number(process.env.CONFIGURATION_PORT ?? 3002);
  await app.listen(port);
  new Logger('configuration-service').log(`⚙️  configuration-service en http://localhost:${port}/api`);
}

bootstrap();
