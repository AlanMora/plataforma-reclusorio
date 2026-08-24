import { ChangeDetectionStrategy, Component, inject, isDevMode, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { mensajeDe } from '../core/problem';
import { IconoComponent } from '../shared/icono.component';

/** RF-UI-001/RF-AUT-*: acceso con correo y contraseña; error genérico. */
@Component({
  selector: 'rw-login',
  standalone: true,
  imports: [FormsModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = isDevMode() ? 'admin@reclusorio.mx' : '';
  password = isDevMode() ? 'Reclusorio#Dev2026' : '';
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
