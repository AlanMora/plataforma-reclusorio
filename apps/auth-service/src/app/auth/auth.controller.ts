import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Public } from '@icms/auth';
import { Idempotent } from '@icms/redis';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';

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
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
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
  async logout(@CurrentUser() user: AuthenticatedUser) {
    if (user.sessionId) {
      await this.auth.revoke(user.sessionId);
    }
  }
}
