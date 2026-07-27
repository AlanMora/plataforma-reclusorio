import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AppConfigModule, LoggingModule, ObservabilityModule, JwtModule.register({})],
  providers: [RealtimeGateway],
})
export class AppModule {}
