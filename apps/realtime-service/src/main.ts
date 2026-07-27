import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { configureApp } from '@icms/common';
import { AppModule } from './app/app.module';
import { RedisIoAdapter } from './app/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  // Swagger deshabilitado: la superficie principal es WebSocket, no REST.
  configureApp(app, {
    serviceName: 'realtime-service',
    description: 'Servicio de tiempo real (WebSocket)',
    enableSwagger: false,
    enableCors: true,
  });

  const logger = new Logger('realtime-service');

  // Adaptador Redis para escalado horizontal (best-effort: cae a memoria si falla).
  try {
    const redisAdapter = new RedisIoAdapter(app);
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
  } catch (err) {
    logger.warn(`No se pudo configurar el adaptador Redis, usando memoria: ${(err as Error).message}`);
  }

  const port = Number(process.env.REALTIME_PORT ?? 3009);
  await app.listen(port);
  logger.log(`🔴 realtime-service (WebSocket) en http://localhost:${port}`);
}

bootstrap();
