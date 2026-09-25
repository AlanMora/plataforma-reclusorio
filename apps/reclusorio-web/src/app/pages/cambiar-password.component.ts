import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { mensajeDe } from '../core/problem';
import { validarFormulario } from '../core/validacion-formulario';
import { IconoComponent } from '../shared/icono.component';

/**
 * Cambio obligatorio de contraseña: primer ingreso o contraseña restablecida
 * por un administrador. Vive fuera del layout privado — mientras el JWT
 * traiga `mustChangePassword` no hay menú ni módulos (el backend responde
 * 403 a todo lo demás). Al cambiarla el backend revoca todas las sesiones,
 * así que se vuelve a entrar en automático con la contraseña nueva.
 */
@Component({
  selector: 'rw-cambiar-password',
  standalone: true,
  imports: [FormsModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cambiar-password.component.html',
})
export class CambiarPasswordComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  passwords = { currentPassword: '', newPassword: '', confirmPassword: '' };
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  async cambiar(formulario: NgForm, evento: SubmitEvent): Promise<void> {
    const errorValidacion = validarFormulario(formulario, evento);
    if (errorValidacion) {
      this.error.set(errorValidacion);
      return;
    }
    if (this.passwords.newPassword !== this.passwords.confirmPassword) {
      this.error.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (this.passwords.newPassword === this.passwords.currentPassword) {
      this.error.set('La nueva contraseña debe ser distinta de la temporal.');
      return;
    }
    const username = this.auth.username();
    const nueva = this.passwords.newPassword;
    this.enviando.set(true);
    this.error.set(null);
    try {
      await this.api.postSinRespuesta('/api/v1/auth/change-password', this.passwords);
    } catch (err) {
      this.error.set(mensajeDe(err));
      this.enviando.set(false);
      return;
    }
    try {
      // Las sesiones anteriores quedaron revocadas: entrar con la nueva.
      await this.auth.login(username, nueva);
      await this.router.navigateByUrl('/');
    } catch {
      this.auth.forzarLogout('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
    } finally {
      this.enviando.set(false);
    }
  }

  salir(): void {
    this.auth.cerrarSesion();
  }
}
