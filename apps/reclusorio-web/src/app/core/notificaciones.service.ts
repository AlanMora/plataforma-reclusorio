import { effect, inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Notificacion, Paginado } from './models';

/**
 * Bandeja de notificaciones del usuario (RF-NOT-001..004).
 * El contador de no leídas alimenta la campana del layout.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly noLeidas = signal(0);
  /** Última notificación llegada por socket: refresca campana y dispara toast. */
  readonly ultimaEnVivo = signal<Notificacion | null>(null);
  private sondeo: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      if (this.auth.autenticado()) {
        void this.refrescarContador();
        this.sondeo = setInterval(() => void this.refrescarContador(), 60_000);
      } else {
        if (this.sondeo) clearInterval(this.sondeo);
        this.sondeo = null;
        this.noLeidas.set(0);
      }
    });
  }

  listar(opciones: { buscar?: string; page?: number; limit?: number }): Promise<Paginado<Notificacion>> {
    return this.api.get<Paginado<Notificacion>>('/api/v1/notifications/inbox', opciones);
  }

  async marcarLeida(id: string): Promise<void> {
    await this.api.post(`/api/v1/notifications/inbox/${id}/leida`, {});
    void this.refrescarContador();
  }

  /** Notificación empujada por el realtime (evento notification.created). */
  recibirEnVivo(n: { id: string; titulo?: string; mensaje: string; url?: string }): void {
    this.noLeidas.update((v) => v + 1);
    this.ultimaEnVivo.set({
      id: n.id,
      titulo: n.titulo ?? 'Notificación',
      mensaje: n.mensaje,
      url: n.url,
      leida: false,
      createdAt: new Date().toISOString(),
    });
  }

  async refrescarContador(): Promise<void> {
    try {
      const pagina = await this.listar({ page: 1, limit: 50 });
      this.noLeidas.set(pagina.items.filter((n) => !n.leida).length);
    } catch {
      // silencioso: la campana no debe romper la app
    }
  }
}
