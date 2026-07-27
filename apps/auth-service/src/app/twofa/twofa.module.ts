import { Body, Controller, Module, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '@icms/auth';

class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  otp!: string;
}

/**
 * Segundo factor (2FA). El andamiaje expone enable/verify; la generación de
 * secretos TOTP y su validación se completan por proyecto (p.ej. otplib).
 */
@ApiTags('2fa')
@ApiBearerAuth()
@Controller('2fa')
export class TwoFactorController {
  @Post('enable')
  @ApiOperation({ summary: 'Iniciar activación de 2FA (devuelve secreto/QR)' })
  enable(@CurrentUser() _user: AuthenticatedUser) {
    return { message: 'not-implemented', secret: null, otpauthUrl: null };
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verificar OTP y activar 2FA' })
  verify(@CurrentUser() _user: AuthenticatedUser, @Body() _dto: VerifyOtpDto) {
    return { message: 'not-implemented' };
  }
}

@Module({ controllers: [TwoFactorController] })
export class TwoFactorModule {}
