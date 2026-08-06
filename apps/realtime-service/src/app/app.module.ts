import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from '@icms/config';
import { LoggingModule } from '@icms/logging';
import { ObservabilityModule } from '@icms/observability';
import { MessagingModule } from '@icms/messaging';
import { RealtimeGateway } from './realtime.gateway';
import { SessionRevokedConsumer } from './session-revoked.consumer';

@Module({
  imports: [AppConfigModule, LoggingModule, ObservabilityModule, JwtModule.register({}), MessagingModule.forRoot()],
  providers: [RealtimeGateway, SessionRevokedConsumer],
})
export class AppModule {}
