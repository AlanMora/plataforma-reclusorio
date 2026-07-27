import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { JwtPayload } from '@icms/auth';
import { UnauthorizedDomainException } from '@icms/common';
import { EventPublisher } from '@icms/messaging';
import { EventNames } from '@icms/contracts';
import { User } from '../users/user.entity';
import { Session } from '../sessions/session.entity';
import { LoginDto, RegisterDto } from './dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Núcleo de autenticación. El andamiaje deja el flujo y las firmas listas;
 * la verificación de contraseñas (bcrypt/argon2) y el hashing de refresh tokens
 * se completan por proyecto.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly events: EventPublisher,
  ) {}

  async register(dto: RegisterDto): Promise<{ id: string }> {
    // TODO(proyecto): hashear contraseña con argon2/bcrypt.
    const user = this.users.create({
      email: dto.email,
      passwordHash: `hash:${dto.password}`,
      tenantId: dto.tenantId,
      roles: ['user'],
    });
    const saved = await this.users.save(user);
    await this.events.publish(EventNames.UserRegistered, { userId: saved.id, email: saved.email });
    return { id: saved.id };
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.users.findOne({ where: { email: dto.email, isActive: true } });
    // TODO(proyecto): verificar hash de contraseña y, si aplica, el OTP de 2FA.
    if (!user || user.passwordHash !== `hash:${dto.password}`) {
      throw new UnauthorizedDomainException('Credenciales inválidas');
    }
    return this.issueTokens(user);
  }

  async issueTokens(user: User): Promise<TokenPair> {
    const sessionId = randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles ?? [],
      permissions: [],
      sid: sessionId,
      iss: this.config.get<string>('JWT_ISSUER', 'icms-platform'),
    };

    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '900s');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const secret = this.config.get<string>('JWT_SECRET', 'change-me-in-production');

    const accessToken = await this.jwt.signAsync(payload, { secret, expiresIn: accessTtl });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId },
      { secret, expiresIn: refreshTtl },
    );

    await this.sessions.save(
      this.sessions.create({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: `hash:${refreshToken}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      }),
    );

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId }, { revokedAt: new Date() });
    await this.events.publish(EventNames.SessionRevoked, { sessionId });
  }
}
