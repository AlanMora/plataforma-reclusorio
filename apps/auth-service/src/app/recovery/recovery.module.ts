import { Body, Controller, HttpCode, Module, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Public } from '@icms/auth';

class RequestRecoveryDto {
  @IsEmail()
  email!: string;
}

class ConfirmRecoveryDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  newPassword!: string;
}

/**
 * Recuperación de cuenta. El andamiaje deja los endpoints; la generación de
 * tokens de un solo uso y el envío por notification-service se completan por
 * proyecto.
 */
@ApiTags('recovery')
@Controller('recovery')
export class RecoveryController {
  @Public()
  @Post('request')
  @HttpCode(202)
  @ApiOperation({ summary: 'Solicitar recuperación de cuenta' })
  request(@Body() _dto: RequestRecoveryDto) {
    return { message: 'Si el correo existe, se enviarán instrucciones' };
  }

  @Public()
  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirmar recuperación con token' })
  confirm(@Body() _dto: ConfirmRecoveryDto) {
    return { message: 'not-implemented' };
  }
}

@Module({ controllers: [RecoveryController] })
export class RecoveryModule {}
