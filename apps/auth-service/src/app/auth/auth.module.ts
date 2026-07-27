import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@icms/database';
import { User } from '../users/user.entity';
import { SessionStore } from '../sessions/session-store.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule.forFeature([User]), JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, SessionStore],
  exports: [AuthService, SessionStore],
})
export class AuthModule {}
