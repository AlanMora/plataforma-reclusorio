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

  async refrescarContador(): Promise<void> {
    try {
      const pagina = await this.listar({ page: 1, limit: 50 });
      this.noLeidas.set(pagina.items.filter((n) => !n.leida).length);
    } catch {
      // silencioso: la campana no debe romper la app
    }
  }
}
