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
    serviceName: 'notification-service',
    description: 'Correo, SMS, push y notificaciones internas; plantillas, reintentos e historial',
  });

  const port = Number(process.env.NOTIFICATION_PORT ?? 3005);
  await app.listen(port);
  new Logger('notification-service').log(`📣 notification-service en http://localhost:${port}/api`);
}

bootstrap();
