import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { SharedAuthModule, JwtAuthGuard } from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { MessagingModule } from '@icms/messaging';
import { ExampleEntity } from './example/example.entity';
import { ExampleModule } from './example/example.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    SharedAuthModule,
    MessagingModule.forRoot(),
    DatabaseModule.forRoot({ database: 'icms_core', entities: [ExampleEntity] }),
    ExampleModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
