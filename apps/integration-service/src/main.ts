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
    serviceName: 'integration-service',
    description: 'Conexiones con sistemas externos: APIs, webhooks, transformación, outbox y conciliación',
  });

  const port = Number(process.env.INTEGRATION_PORT ?? 3006);
  await app.listen(port);
  new Logger('integration-service').log(`🔌 integration-service en http://localhost:${port}/api`);
}

bootstrap();
