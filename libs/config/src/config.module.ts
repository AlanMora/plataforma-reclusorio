import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Módulo de configuración compartido. Carga `.env`, valida variables mínimas y
 * expone el `FeatureFlagsService` de forma global.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService, NestConfigModule],
})
export class AppConfigModule {}
