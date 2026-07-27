import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { SharedAuthModule, JwtAuthGuard } from '@icms/auth';
import { DatabaseModule } from '@icms/database';
import { JobRun } from './job-run.entity';
import { SchedulerModule } from './scheduler.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ObservabilityModule,
    SharedAuthModule,
    DatabaseModule.forRoot({ database: 'icms_scheduler', entities: [JobRun] }),
    SchedulerModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
