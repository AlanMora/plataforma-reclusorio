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
    serviceName: 'scheduler-service',
    description: 'Cron distribuido: programación, control de ejecuciones, reintentos e historial',
  });

  const port = Number(process.env.SCHEDULER_PORT ?? 3008);
  await app.listen(port);
  new Logger('scheduler-service').log(`⏰ scheduler-service en http://localhost:${port}/api`);
}

bootstrap();
