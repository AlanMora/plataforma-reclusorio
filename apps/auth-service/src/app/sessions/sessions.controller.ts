import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@icms/auth';
import { ForbiddenDomainException } from '@icms/common';
import { AuthService } from '../auth/auth.service';
import { SessionStore } from './session-store.service';

/**
 * Gestión de las sesiones activas del usuario autenticado (respaldadas en Redis).
 * Un usuario sólo puede ver y revocar sus propias sesiones.
 */
@ApiTags('sessions')
@ApiBearerAuth()
@Controller('auth/sessions')
export class SessionsController {
  constructor(
    private readonly sessions: SessionStore,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar las sesiones activas del usuario autenticado' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.listUserSessionsDetailed(user.id);
  }

  @Delete(':sid')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revocar una sesión propia por id' })
  async revoke(@Param('sid') sid: string, @CurrentUser() user: AuthenticatedUser) {
    const session = await this.sessions.get(sid);
    // Sólo el dueño de la sesión puede revocarla.
    if (session && session.userId !== user.id) {
      throw new ForbiddenDomainException('No puedes revocar sesiones de otro usuario');
    }
    await this.auth.revoke(sid);
  }

  @Post('revoke-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revocar todas las sesiones del usuario (cierre global)' })
  async revokeAll(@CurrentUser() user: AuthenticatedUser) {
    const revoked = await this.sessions.revokeAllForUser(user.id);
    return { revoked };
  }
}
