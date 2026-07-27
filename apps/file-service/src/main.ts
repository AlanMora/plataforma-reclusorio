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
    serviceName: 'file-service',
    description: 'Almacenamiento documental: carga/descarga, metadatos, versiones y URLs temporales',
  });

  const port = Number(process.env.FILE_PORT ?? 3007);
  await app.listen(port);
  new Logger('file-service').log(`📁 file-service en http://localhost:${port}/api`);
}

bootstrap();
