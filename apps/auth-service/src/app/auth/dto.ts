import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  otp?: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  /** Política mínima provisional (DP-004 pendiente): 12 caracteres. */
  @IsString() @MinLength(12) newPassword!: string;
  @IsString() confirmPassword!: string;
}
