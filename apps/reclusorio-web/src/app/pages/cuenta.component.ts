import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { SessionService } from '../core/session.service';
import { ToastService } from '../core/toast.service';
import { SesionActiva, UsuarioMe } from '../core/models';
import { mensajeDe } from '../core/problem';

/**
 * Mi cuenta (RF-CUE-001/002): datos y permisos del usuario, vigencia de la
 * sesión con opción de extenderla, cambio de contraseña (revoca todas las
 * sesiones) y sesiones activas.
 */
@Component({
  selector: 'rw-cuenta',
  standalone: true,
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cuenta.component.html',
})
export class CuentaComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly session = inject(SessionService);

  readonly usuario = signal<UsuarioMe | null>(null);
  readonly sesiones = signal<SesionActiva[]>([]);
  readonly cambiando = signal(false);
  readonly errorPassword = signal<string | null>(null);

  passwords = { currentPassword: '', newPassword: '', confirmPassword: '' };

  ngOnInit(): void {
    void this.api.get<UsuarioMe>('/api/v1/users/me').then((u) => this.usuario.set(u)).catch(() => undefined);
    void this.cargarSesiones();
  }

  minutos(): string {
    const s = this.session.restante();
    return s === null ? '—' : String(Math.max(Math.ceil(s / 60), 0));
  }

  async cambiarPassword(): Promise<void> {
    if (this.passwords.newPassword !== this.passwords.confirmPassword) {
      this.errorPassword.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    this.cambiando.set(true);
    this.errorPassword.set(null);
    try {
      await this.api.postSinRespuesta('/api/v1/auth/change-password', this.passwords);
      // El backend revoca TODAS las sesiones (RF-CUE-002).
      this.auth.forzarLogout('Contraseña actualizada. Inicia sesión con la nueva contraseña.');
    } catch (err) {
      this.errorPassword.set(mensajeDe(err));
    } finally {
      this.cambiando.set(false);
    }
  }

  async cerrarTodas(): Promise<void> {
    try {
      await this.api.post('/api/v1/auth/sessions/revoke-all', {});
      this.auth.forzarLogout('Cerraste todas tus sesiones.');
    } catch (err) {
      this.toast.error(mensajeDe(err));
    }
  }

  private async cargarSesiones(): Promise<void> {
    try {
      this.sesiones.set(await this.api.get<SesionActiva[]>('/api/v1/auth/sessions'));
    } catch {
      // listado de sesiones no crítico
    }
  }
}
