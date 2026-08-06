import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { mensajeDe } from '../core/problem';

/** RF-UI-001/RF-AUT-*: acceso con correo y contraseña; error genérico. */
@Component({
  selector: 'rw-login',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center px-4">
      <div class="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-borde md:grid-cols-2">
        <!-- Panel de identidad -->
        <div class="relative hidden flex-col justify-between bg-panel p-10 md:flex">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.35em] text-neon">Sistema penitenciario</p>
            <h1 class="mt-3 text-3xl font-bold leading-tight text-slate-100">
              Plataforma de<br />Gestión de<br />Reclusorio
            </h1>
          </div>
          <div class="space-y-2">
            <div class="h-px w-full bg-gradient-to-r from-neon/60 to-transparent"></div>
            <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Acceso restringido · sesión de 30 minutos
            </p>
            <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
              Toda la actividad queda auditada
            </p>
          </div>
          <div
            class="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-neon/10 blur-3xl"
          ></div>
        </div>

        <!-- Formulario -->
        <div class="bg-panel-2/80 p-10 backdrop-blur">
          <h2 class="titulo">Iniciar sesión</h2>
          <p class="mt-1 text-sm text-slate-500">Identifícate con tu cuenta institucional.</p>

          @if (auth.avisoLogout(); as aviso) {
            <p class="alerta-info mt-5">{{ aviso }}</p>
          }
          @if (error()) {
            <p class="alerta-error mt-5">{{ error() }}</p>
          }

          <form class="mt-6 space-y-4" (ngSubmit)="entrar()">
            <div>
              <label class="campo-etiqueta obligatorio" for="email">Correo</label>
              <input
                class="campo"
                id="email"
                name="email"
                type="email"
                autocomplete="username"
                required
                [(ngModel)]="email"
                placeholder="usuario&#64;institucion.gob.mx"
              />
            </div>
            <div>
              <label class="campo-etiqueta obligatorio" for="password">Contraseña</label>
              <input
                class="campo"
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                [(ngModel)]="password"
              />
            </div>
            <button class="btn-primario w-full justify-center py-2.5" type="submit" [disabled]="enviando()">
              {{ enviando() ? 'Verificando…' : 'Entrar al sistema' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  async entrar(): Promise<void> {
    if (!this.email || !this.password) return;
    this.enviando.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email.trim(), this.password);
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.enviando.set(false);
    }
  }
}
