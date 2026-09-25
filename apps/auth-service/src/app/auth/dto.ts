import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/** Formato del nombre de usuario: 3–30 caracteres a-z, 0-9, punto, guion o guion bajo. */
export const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
export const USERNAME_MENSAJE =
  'El nombre de usuario debe tener de 3 a 30 caracteres: letras sin acentos, números, punto, guion o guion bajo';

/** Normaliza el nombre de usuario (sin espacios, en minúsculas). */
export const normalizarUsername = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(normalizarUsername)
  @IsString()
  @IsNotEmpty()
  username!: string;

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

export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  /** Política mínima provisional (DP-004 pendiente): 12 caracteres. */
  @IsString() @MinLength(12) newPassword!: string;
  @IsString() confirmPassword!: string;
}
