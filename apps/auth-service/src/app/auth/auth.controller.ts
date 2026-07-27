import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@icms/auth';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar un usuario de acceso' })
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
  @ApiOperation({ summary: 'Renovar access token con refresh token' })
  refresh(@Body() _dto: RefreshDto) {
    // TODO(proyecto): validar refresh token contra la sesión y rotar.
    return { message: 'not-implemented' };
  }
}
