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
  template: `
    <div class="mx-auto max-w-5xl space-y-5">
      <div>
        <p class="etiqueta">Cuenta</p>
        <h2 class="text-2xl font-bold text-slate-100">{{ auth.email() }}</h2>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <!-- Sesión -->
        <div class="panel space-y-4 p-6">
          <p class="etiqueta">Sesión vigente (RF-CUE-001)</p>
          <div class="flex items-baseline gap-3">
            <span class="font-mono text-4xl text-neon">{{ minutos() }}</span>
            <span class="text-sm text-slate-500">minutos restantes de 30 (renovables)</span>
          </div>
          <p class="font-mono text-xs text-slate-600">sesión {{ auth.sid() || '—' }}</p>
          <button class="btn-primario" type="button" [disabled]="session.extendiendo()" (click)="session.extender()">
            {{ session.extendiendo() ? 'Extendiendo…' : 'Extender sesión 30 min' }}
          </button>

          <div class="border-t border-borde pt-4">
            <p class="etiqueta mb-2">Permisos activos ({{ auth.permisos().length }})</p>
            <div class="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              @for (p of auth.permisos(); track p) {
                <span class="chip-apagado">{{ p }}</span>
              }
            </div>
          </div>
        </div>

        <!-- Cambio de contraseña -->
        <div class="panel space-y-4 p-6">
          <p class="etiqueta">Cambio de contraseña (RF-CUE-002)</p>
          <form class="space-y-3" (ngSubmit)="cambiarPassword()">
            <div>
              <label class="campo-etiqueta obligatorio" for="passwordActual">Contraseña actual</label>
              <input class="campo" id="passwordActual" name="currentPassword" type="password" required autocomplete="current-password" [(ngModel)]="passwords.currentPassword" />
            </div>
            <div>
              <label class="campo-etiqueta obligatorio" for="passwordNueva">Nueva contraseña (mínimo 12)</label>
              <input class="campo" id="passwordNueva" name="newPassword" type="password" minlength="12" required autocomplete="new-password" [(ngModel)]="passwords.newPassword" />
            </div>
            <div>
              <label class="campo-etiqueta obligatorio" for="passwordConfirmacion">Confirmar nueva contraseña</label>
              <input class="campo" id="passwordConfirmacion" name="confirmPassword" type="password" minlength="12" required autocomplete="new-password" [(ngModel)]="passwords.confirmPassword" />
            </div>
            @if (errorPassword()) {
              <p class="alerta-error">{{ errorPassword() }}</p>
            }
            <p class="text-[11px] text-slate-600">
              Al cambiarla se revocan TODAS tus sesiones y deberás iniciar de nuevo.
            </p>
            <button class="btn-primario w-full justify-center" type="submit" [disabled]="cambiando()">
              {{ cambiando() ? 'Aplicando…' : 'Cambiar contraseña' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Sesiones activas -->
      <div class="panel space-y-3 p-6">
        <div class="flex items-center justify-between">
          <p class="etiqueta">Sesiones activas (auditoría con IP, DP-003)</p>
          <button class="btn-peligro btn-mini" type="button" (click)="cerrarTodas()">Cerrar todas</button>
        </div>
        <table class="tabla">
          <thead>
            <tr><th>Sesión</th><th>IP</th><th>Agente</th><th>Inicio</th><th></th></tr>
          </thead>
          <tbody>
            @for (s of sesiones(); track s.sessionId) {
              <tr>
                <td class="font-mono text-xs">
                  {{ s.sessionId.slice(0, 8) }}…
                  @if (s.sessionId === auth.sid()) {
                    <span class="chip-ok ml-2">actual</span>
                  }
                </td>
                <td class="font-mono text-xs">{{ s.ipAddress || '—' }}</td>
                <td class="max-w-[280px] truncate text-xs" [title]="s.userAgent || ''">{{ s.userAgent || '—' }}</td>
                <td class="font-mono text-xs">{{ s.createdAt | date: 'dd/MM/yy HH:mm' }}</td>
                <td></td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (usuario(); as u) {
        <div class="panel p-6">
          <p class="etiqueta mb-3">Datos de la cuenta</p>
          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <p class="etiqueta">Correo</p>
              <p class="text-sm text-slate-200">{{ u.email }}</p>
            </div>
            <div>
              <p class="etiqueta">Estado</p>
              <span [class]="u.isActive ? 'chip-ok' : 'chip-peligro'">{{ u.isActive ? 'activa' : 'inactiva' }}</span>
            </div>
            <div>
              <p class="etiqueta">Roles</p>
              <p class="text-sm text-slate-200">{{ u.roles.join(', ') || '—' }}</p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
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
