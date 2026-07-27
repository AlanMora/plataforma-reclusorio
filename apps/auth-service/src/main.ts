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
    serviceName: 'auth-service',
    description: 'Identidad, autenticación, sesiones, 2FA y auditoría de seguridad',
  });

  const port = Number(process.env.AUTH_PORT ?? 3001);
  await app.listen(port);
  new Logger('auth-service').log(`🔐 auth-service escuchando en http://localhost:${port}/api`);
}

bootstrap();
