import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@icms/database';
import { User } from '../users/user.entity';
import { SessionStore } from '../sessions/session-store.service';
import { SessionsController } from '../sessions/sessions.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KeyService } from './key.service';
import { JwksController } from './jwks.controller';

@Module({
  imports: [DatabaseModule.forFeature([User]), JwtModule.register({})],
  controllers: [AuthController, JwksController, SessionsController],
  providers: [AuthService, SessionStore, KeyService],
  exports: [AuthService, SessionStore],
})
export class AuthModule {}
