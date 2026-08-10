import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AllExceptionsFilter, fabricaErroresValidacion } from '@icms/common';
import { AppModule } from './app/app.module';

async function bootstrap() {
  // bodyParser deshabilitado: el gateway reenvía el stream crudo al upstream.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });

  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, exceptionFactory: fabricaErroresValidacion }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.GATEWAY_PORT ?? 3000);
  await app.listen(port);

  const logger = new Logger('gateway-service');
  logger.log(`🚪 gateway-service (punto público) escuchando en http://localhost:${port}`);
}

bootstrap();
