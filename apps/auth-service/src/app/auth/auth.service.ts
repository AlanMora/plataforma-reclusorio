import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { JwtPayload } from '@icms/auth';
import { UnauthorizedDomainException } from '@icms/common';
import { EventPublisher, OutboxService } from '@icms/messaging';
import { EventNames } from '@icms/contracts';
import { User } from '../users/user.entity';
import { SessionStore } from '../sessions/session-store.service';
import { KeyService } from './key.service';
import { LoginDto, RegisterDto } from './dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// Hash dummy (argon2id) para comparar en tiempo constante cuando el usuario no
// existe, evitando filtrar por tiempo qué correos están registrados.
let dummyHashPromise: Promise<string> | null = null;
const dummyHash = () => (dummyHashPromise ??= argon2Hash('invalid-password-placeholder'));

/**
 * Hash de un refresh token con SHA-256. Los tokens son de alta entropía, así que
 * un hash rápido es apropiado — y evita la truncación de bcrypt a 72 bytes (un
 * JWT excede ese límite y su parte única quedaría fuera).
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparación en tiempo constante de dos hashes hex. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Convierte TTLs tipo "900s", "15m", "7d" a segundos. */
function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const factors: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (factors[unit] ?? 1);
}

/**
 * Núcleo de autenticación:
 *  - Contraseñas hasheadas con bcrypt (nunca en claro).
 *  - Sesiones y refresh tokens en Redis (revocación instantánea + TTL nativo).
 *  - Rotación de refresh token en cada renovación.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly sessions: SessionStore,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly events: EventPublisher,
    private readonly keys: KeyService,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  /** Crea el usuario y publica UserRegistered de forma transaccional (Outbox). */
  async register(dto: RegisterDto): Promise<{ id: string }> {
    const passwordHash = await argon2Hash(dto.password); // argon2id por defecto
    return this.dataSource.transaction(async (manager) => {
      const user = manager.getRepository(User).create({
        email: dto.email,
        passwordHash,
        tenantId: dto.tenantId,
        roles: ['user'],
      });
      const saved = await manager.save(user);
      await this.outbox.enqueue(
        manager,
        EventNames.UserRegistered,
        { userId: saved.id, email: saved.email },
        { tenantId: saved.tenantId ?? undefined, aggregateId: saved.id },
      );
      return { id: saved.id };
    });
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.users.findOne({ where: { email: dto.email, isActive: true } });
    // Compara siempre contra un hash (aunque el usuario no exista) para no filtrar
    // por tiempo si un email está o no registrado.
    const stored = user?.passwordHash ?? (await dummyHash());
    let ok = false;
    try {
      ok = await argon2Verify(stored, dto.password);
    } catch {
      ok = false;
    }
    if (!user || !ok) {
      throw new UnauthorizedDomainException('Credenciales inválidas');
    }
    // TODO(proyecto): si user.twoFactorEnabled, validar dto.otp antes de emitir tokens.
    return this.issueTokens(user);
  }

  /** Emite un par de tokens. Si `existingSid` se pasa, rota la sesión existente. */
  async issueTokens(user: User, existingSid?: string): Promise<TokenPair> {
    const sessionId = existingSid ?? randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId ?? undefined,
      roles: user.roles ?? [],
      permissions: [],
      sid: sessionId,
      iss: this.config.get<string>('JWT_ISSUER', 'icms-platform'),
    };

    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '900s');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const secret = this.config.get<string>('JWT_SECRET', 'change-me-in-production');

    // Access token firmado con RS256 (clave privada); se valida vía JWKS.
    const accessToken = await this.jwt.signAsync(payload, {
      privateKey: this.keys.privateKeyPem,
      algorithm: 'RS256',
      keyid: this.keys.kid,
      expiresIn: accessTtl,
    });
    // `jti` único: garantiza que cada refresh token sea distinto (aunque se emitan
    // en el mismo segundo), para que la rotación invalide de verdad el anterior.
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, jti: randomUUID() },
      { secret, expiresIn: refreshTtl },
    );

    const refreshTokenHash = hashToken(refreshToken);
    if (existingSid) {
      await this.sessions.rotate(sessionId, refreshTokenHash);
    } else {
      await this.sessions.create(
        sessionId,
        { userId: user.id, refreshTokenHash, createdAt: new Date().toISOString() },
        ttlToSeconds(refreshTtl),
      );
    }

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  /** Renueva el access token validando y ROTANDO el refresh token contra Redis. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const secret = this.config.get<string>('JWT_SECRET', 'change-me-in-production');
    let decoded: { sub: string; sid: string };
    try {
      decoded = this.jwt.verify(refreshToken, { secret });
    } catch {
      throw new UnauthorizedDomainException('Refresh token inválido o expirado');
    }

    const session = await this.sessions.get(decoded.sid);
    if (!session) {
      throw new UnauthorizedDomainException('Sesión inválida o revocada');
    }

    const matches = safeEqual(hashToken(refreshToken), session.refreshTokenHash);
    if (!matches) {
      // Posible reutilización/robo de token: revoca la sesión por seguridad.
      await this.sessions.revoke(decoded.sid);
      throw new UnauthorizedDomainException('Refresh token no reconocido');
    }

    const user = await this.users.findOne({ where: { id: decoded.sub, isActive: true } });
    if (!user) {
      throw new UnauthorizedDomainException('Usuario no válido');
    }
    return this.issueTokens(user, decoded.sid);
  }

  /** Revoca una sesión concreta (logout). */
  async revoke(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
    await this.events.publish(EventNames.SessionRevoked, { sessionId });
  }
}
