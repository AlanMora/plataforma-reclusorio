import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { Paginado } from '../../core/models';
import { mensajeDe } from '../../core/problem';

/** Usuario de acceso tal como lo devuelve auth-service (sin hash). */
interface UsuarioAcceso {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
}

interface ModuloPermisos {
  modulo: string;
  permisos: string[];
}

/**
 * Administración de usuarios de acceso: alta, activar/desactivar,
 * restablecer contraseña y asignación de permisos por módulo — todo desde
 * el sistema, sin tocar la base de datos del servidor. Cambiar permisos,
 * contraseña o desactivar revoca las sesiones del usuario (RF-SES-009):
 * su siguiente login trae el JWT con los claims actualizados.
 */
@Component({
  selector: 'rw-usuarios',
  standalone: true,
  imports: [DatePipe, FormsModule, PermisoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly usuarios = signal<UsuarioAcceso[]>([]);
  readonly catalogo = signal<ModuloPermisos[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  /** Panel expandido por usuario ('permisos' | 'password') y selección. */
  readonly expandido = signal<{ id: string; seccion: 'permisos' | 'password' } | null>(null);
  readonly seleccion = signal<Set<string>>(new Set());

  readonly mostrarForm = signal(false);
  readonly seleccionAlta = signal<Set<string>>(new Set());
  forma = { email: '', password: '' };
  passwordNueva = '';

  readonly totalCatalogo = computed(() =>
    this.catalogo().reduce((n, m) => n + m.permisos.length, 0),
  );

  ngOnInit(): void {
    void this.cargar();
    void this.api
      .get<ModuloPermisos[]>('/api/v1/users/permisos-disponibles')
      .then((c) => this.catalogo.set(c))
      .catch((err) => this.error.set(mensajeDe(err)));
  }

  etiquetaAccion(permiso: string): string {
    return permiso.split(':')[1] ?? permiso;
  }

  // ---- selección de permisos (compartida por alta y edición) ----

  private conjunto(deAlta: boolean): Set<string> {
    return deAlta ? this.seleccionAlta() : this.seleccion();
  }

  private fijar(deAlta: boolean, nuevo: Set<string>): void {
    (deAlta ? this.seleccionAlta : this.seleccion).set(nuevo);
  }

  tiene(permiso: string, deAlta = false): boolean {
    return this.conjunto(deAlta).has(permiso);
  }

  alternar(permiso: string, deAlta = false): void {
    const nuevo = new Set(this.conjunto(deAlta));
    if (nuevo.has(permiso)) nuevo.delete(permiso);
    else nuevo.add(permiso);
    this.fijar(deAlta, nuevo);
  }

  moduloCompleto(modulo: ModuloPermisos, deAlta = false): boolean {
    return modulo.permisos.every((p) => this.conjunto(deAlta).has(p));
  }

  alternarModulo(modulo: ModuloPermisos, deAlta = false): void {
    const nuevo = new Set(this.conjunto(deAlta));
    const completo = this.moduloCompleto(modulo, deAlta);
    for (const p of modulo.permisos) {
      if (completo) nuevo.delete(p);
      else nuevo.add(p);
    }
    this.fijar(deAlta, nuevo);
  }

  seleccionarTodo(deAlta = false): void {
    this.fijar(deAlta, new Set(this.catalogo().flatMap((m) => m.permisos)));
  }

  limpiarSeleccion(deAlta = false): void {
    this.fijar(deAlta, new Set());
  }

  // ---- acciones ----

  abrirSeccion(usuario: UsuarioAcceso, seccion: 'permisos' | 'password'): void {
    const actual = this.expandido();
    if (actual?.id === usuario.id && actual.seccion === seccion) {
      this.expandido.set(null);
      return;
    }
    this.expandido.set({ id: usuario.id, seccion });
    this.passwordNueva = '';
    if (seccion === 'permisos') this.seleccion.set(new Set(usuario.permissions));
  }

  async crear(): Promise<void> {
    this.guardando.set(true);
    try {
      await this.api.post('/api/v1/users', {
        email: this.forma.email.trim(),
        password: this.forma.password,
        permissions: [...this.seleccionAlta()],
      });
      this.toast.ok('Usuario creado.');
      this.mostrarForm.set(false);
      this.forma = { email: '', password: '' };
      this.seleccionAlta.set(new Set());
      await this.cargar();
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async guardarPermisos(usuario: UsuarioAcceso): Promise<void> {
    this.guardando.set(true);
    try {
      await this.api.put(`/api/v1/users/${usuario.id}/permissions`, {
        permissions: [...this.seleccion()],
      });
      this.toast.ok(
        'Permisos guardados. Se cerraron las sesiones del usuario: al volver a entrar tendrá los permisos nuevos.',
      );
      this.expandido.set(null);
      await this.cargar();
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async restablecerPassword(usuario: UsuarioAcceso): Promise<void> {
    this.guardando.set(true);
    try {
      await this.api.patch(`/api/v1/users/${usuario.id}/password`, {
        password: this.passwordNueva,
      });
      this.toast.ok('Contraseña restablecida. Se cerraron las sesiones del usuario.');
      this.expandido.set(null);
      this.passwordNueva = '';
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async alternarActivo(usuario: UsuarioAcceso): Promise<void> {
    this.guardando.set(true);
    try {
      await this.api.patch(`/api/v1/users/${usuario.id}`, { isActive: !usuario.isActive });
      this.toast.ok(
        usuario.isActive
          ? 'Usuario desactivado; sus sesiones fueron revocadas.'
          : 'Usuario activado.',
      );
      await this.cargar();
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  esYo(usuario: UsuarioAcceso): boolean {
    return this.auth.idUsuario() === usuario.id;
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const pagina = await this.api.get<Paginado<UsuarioAcceso>>('/api/v1/users', {
        page: 1,
        limit: 100,
      });
      this.usuarios.set(pagina.items);
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
