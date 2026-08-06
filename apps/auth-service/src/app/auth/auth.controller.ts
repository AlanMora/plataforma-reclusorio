import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Public } from '@icms/auth';
import { Idempotent } from '@icms/redis';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, RegisterDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Idempotent()
  @Post('register')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clave de idempotencia (UUID)' })
  @ApiOperation({ summary: 'Registrar un usuario de acceso (idempotente + outbox)' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens (auditado con IP)' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar access token (valida y rota el refresh en Redis)' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión (revoca la sesión actual en Redis)' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    if (user.sessionId) {
      await this.auth.revoke(user.sessionId, 'logout', user.id, req.ip);
    }
  }

  @Get('session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sesión actual: vigencia restante en segundos (RF-CUE-001)' })
  session(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.sessionInfo(user.sessionId ?? '');
  }

  @Post('change-password')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambio de contraseña con verificación de la actual (RF-CUE-002)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword, dto.confirmPassword, req.ip);
  }
}
