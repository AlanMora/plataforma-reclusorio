import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@icms/redis';

export interface SessionData {
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
}

/**
 * Store de sesiones respaldado en Redis. Ventajas frente a la BD:
 *  - Búsqueda O(1) por sessionId.
 *  - TTL nativo: la sesión expira sola al vencer el refresh token.
 *  - Revocación instantánea (DEL) verificable por cualquier instancia.
 *
 * Claves:
 *   session:{sid}            -> hash con los datos de la sesión (con TTL)
 *   user-sessions:{userId}   -> set con los sid activos del usuario
 */
@Injectable()
export class SessionStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(sid: string): string {
    return `session:${sid}`;
  }

  private userKey(userId: string): string {
    return `user-sessions:${userId}`;
  }

  async create(sid: string, data: SessionData, ttlSeconds: number): Promise<void> {
    await this.redis
      .multi()
      .hset(this.key(sid), { ...data })
      .expire(this.key(sid), ttlSeconds)
      .sadd(this.userKey(data.userId), sid)
      .exec();
  }

  async get(sid: string): Promise<SessionData | null> {
    const data = await this.redis.hgetall(this.key(sid));
    if (!data || Object.keys(data).length === 0) return null;
    return data as unknown as SessionData;
  }

  /** Verifica que la sesión exista y no esté revocada. */
  async isActive(sid: string): Promise<boolean> {
    return (await this.redis.exists(this.key(sid))) === 1;
  }

  /** Rota el refresh token de una sesión existente (mantiene el TTL restante). */
  async rotate(sid: string, refreshTokenHash: string): Promise<void> {
    await this.redis.hset(this.key(sid), 'refreshTokenHash', refreshTokenHash);
  }

  /** Revoca (elimina) una sesión concreta. */
  async revoke(sid: string): Promise<void> {
    const data = await this.get(sid);
    await this.redis.del(this.key(sid));
    if (data?.userId) {
      await this.redis.srem(this.userKey(data.userId), sid);
    }
  }

  /**
   * Revoca todas las sesiones de un usuario (p.ej. tras cambio de contraseña).
   * Devuelve los ids revocados para que el llamador publique `session.revoked`
   * por cada uno (RF-SES-009: el frontend debe enterarse en tiempo real).
   */
  async revokeAllForUser(userId: string): Promise<string[]> {
    const sids = await this.redis.smembers(this.userKey(userId));
    if (sids.length === 0) return [];
    const pipeline = this.redis.multi();
    for (const sid of sids) pipeline.del(this.key(sid));
    pipeline.del(this.userKey(userId));
    await pipeline.exec();
    return sids;
  }

  /** Segundos de vigencia restante de la sesión (RF-CUE-001). */
  async ttlSeconds(sid: string): Promise<number> {
    return this.redis.ttl(this.key(sid));
  }

  async listUserSessions(userId: string): Promise<string[]> {
    return this.redis.smembers(this.userKey(userId));
  }

  /** Lista las sesiones activas del usuario con sus metadatos (sin el hash del token). */
  async listUserSessionsDetailed(
    userId: string,
  ): Promise<Array<{ sessionId: string; userId: string; userAgent?: string; ipAddress?: string; createdAt: string }>> {
    const sids = await this.listUserSessions(userId);
    const sessions: Array<{
      sessionId: string;
      userId: string;
      userAgent?: string;
      ipAddress?: string;
      createdAt: string;
    }> = [];
    for (const sid of sids) {
      const data = await this.get(sid);
      if (!data) continue; // sesión ya expirada: se ignora
      sessions.push({
        sessionId: sid,
        userId: data.userId,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        createdAt: data.createdAt,
      });
    }
    return sessions;
  }
}
