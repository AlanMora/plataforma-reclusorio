import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard, PermissionsGuard, RolesGuard } from './guards';

/**
 * Módulo de autenticación compartido. Importándolo, un servicio obtiene la
 * validación JWT completa y los guards de roles/permisos listos para usar.
 */
@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard, PermissionsGuard],
  exports: [JwtStrategy, JwtAuthGuard, RolesGuard, PermissionsGuard, PassportModule],
})
export class SharedAuthModule {}
