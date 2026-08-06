import { effect, inject, Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';

interface EventoRevocacion {
  sessionId: string;
  motivo?: 'logout' | 'revocacion-administrativa' | 'cambio-password';
}

const MOTIVOS: Record<string, string> = {
  logout: 'Tu sesión fue cerrada.',
  'revocacion-administrativa': 'Un administrador revocó tu sesión.',
  'cambio-password': 'Tu contraseña cambió; vuelve a iniciar sesión.',
};

/**
 * Revocación de sesión en TIEMPO REAL (RF-SES-009 / DP-009):
 * el auth-service publica `session.revoked`, el realtime-service lo emite
 * a la sala `user:{id}` y aquí se fuerza el cierre inmediato de la UI.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  constructor() {
    effect(() => {
      if (this.auth.autenticado()) this.conectar();
      else this.desconectar();
    });
  }

  private conectar(): void {
    if (this.socket) return;
    // El token se resuelve por callback: tras cada rotación de refresh,
    // una reconexión usa siempre el access token vigente.
    this.socket = io({
      auth: (cb) => cb({ token: this.auth.tokens()?.accessToken }),
      reconnectionDelayMax: 10_000,
    });
    this.socket.on('session.revoked', (evento: EventoRevocacion) => {
      const propia = !evento?.sessionId || evento.sessionId === this.auth.sid();
      if (!propia) return;
      // El logout voluntario ya limpió el estado; solo actuar si sigue viva.
      if (this.auth.autenticado()) {
        this.auth.forzarLogout(MOTIVOS[evento?.motivo ?? ''] ?? 'Tu sesión fue revocada.');
      }
    });
  }

  private desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
