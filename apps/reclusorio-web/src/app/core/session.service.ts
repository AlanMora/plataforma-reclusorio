import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { SesionInfo } from './models';

const AVISO_SEGUNDOS = 5 * 60; // RF-UI: aviso a 5 minutos de expirar

/**
 * Vigilante de la sesión de 30 minutos (RF-SES-002 + RF-CUE-001).
 * Sincroniza la vigencia real con GET /auth/session, mantiene una cuenta
 * regresiva local y dispara el aviso de expiración a 5 minutos (RF-UI).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Segundos restantes de la sesión; null mientras no se conoce. */
  readonly restante = signal<number | null>(null);
  readonly avisoActivo = computed(() => {
    const s = this.restante();
    return s !== null && s > 0 && s <= AVISO_SEGUNDOS;
  });
  readonly extendiendo = signal(false);

  private tictac: ReturnType<typeof setInterval> | null = null;
  private sincronizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      if (this.auth.autenticado()) this.iniciar();
      else this.detener();
    });
  }

  /** Renueva la vigencia: el refresh rota tokens y reinicia los 30 min (RF-SES-008). */
  async extender(): Promise<void> {
    this.extendiendo.set(true);
    try {
      await this.auth.refrescar();
      await this.sincronizar();
      this.toast.ok('Sesión extendida 30 minutos más.');
    } catch {
      this.auth.forzarLogout('No fue posible extender la sesión; inicia sesión nuevamente.');
    } finally {
      this.extendiendo.set(false);
    }
  }

  private iniciar(): void {
    this.detener();
    void this.sincronizar();
    // Cuenta local por segundo; re-sincroniza contra Redis cada 60 s.
    this.tictac = setInterval(() => {
      const actual = this.restante();
      if (actual === null) return;
      const siguiente = actual - 1;
      this.restante.set(siguiente);
      if (siguiente <= 0) {
        this.auth.forzarLogout('Tu sesión de 30 minutos expiró.');
      }
    }, 1000);
    this.sincronizador = setInterval(() => void this.sincronizar(), 60_000);
  }

  private detener(): void {
    if (this.tictac) clearInterval(this.tictac);
    if (this.sincronizador) clearInterval(this.sincronizador);
    this.tictac = null;
    this.sincronizador = null;
    this.restante.set(null);
  }

  private async sincronizar(): Promise<void> {
    if (!this.auth.autenticado()) return;
    try {
      const info = await this.api.get<SesionInfo>('/api/v1/auth/session');
      if (info.expiresInSeconds <= 0) {
        this.auth.forzarLogout('Tu sesión ya no está vigente.');
        return;
      }
      this.restante.set(info.expiresInSeconds);
    } catch {
      // Errores transitorios: la cuenta local sigue; el interceptor maneja el 401.
    }
  }
}
