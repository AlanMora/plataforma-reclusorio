import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PermisoDirective } from '../../core/permiso.directive';
import { PaginadorComponent } from '../../shared/paginador.component';
import { ModalFormulario } from '../../shared/modal-formulario/modal-formulario';
import { ModuloPermisos, PermisosMatrizComponent } from './permisos-matriz.component';
import { Paginado } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { presentarErrorFormulario, validarFormulario } from '../../core/validacion-formulario';
import { IconoComponent } from '../../shared/icono.component';

/** Usuario de acceso tal como lo devuelve auth-service (sin hash). */
interface UsuarioAcceso {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
}

/**
 * Administración de usuarios de acceso: alta, activar/desactivar,
 * restablecer contraseña y asignación de permisos por módulo — todo desde
 * el sistema, sin tocar la base de datos del servidor.
 *
 * Cambiar permisos NO cierra sesiones: si editas tu propia cuenta el token
 * se refresca en silencio y el menú se actualiza al instante; para otros
 * usuarios el cambio entra solo en su siguiente renovación de token (≤10
 * minutos). Desactivar o restablecer contraseña sí revoca sesiones
 * (RF-SES-009), porque ahí cortar el acceso es el objetivo.
 */
@Component({
  selector: 'rw-usuarios',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    PermisoDirective,
    PaginadorComponent,
    PermisosMatrizComponent,
    ModalFormulario,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  /** Paginación server-side estándar de la plataforma (DP-010). */
  readonly pagina = signal<Paginado<UsuarioAcceso>>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  readonly catalogo = signal<ModuloPermisos[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly guardando = signal(false);

  /** Panel expandido por usuario ('permisos' | 'password') y selección. */
  readonly expandido = signal<{ id: string; seccion: 'permisos' | 'password' } | null>(null);
  readonly seleccion = signal<Set<string>>(new Set());

  readonly mostrarForm = signal(false);
  readonly seleccionAlta = signal<Set<string>>(new Set());
  readonly usuarioExpandido = computed(() => {
    const expandido = this.expandido();
    return expandido
      ? (this.pagina().items.find((usuario) => usuario.id === expandido.id) ?? null)
      : null;
  });
  forma = { email: '', password: '' };
  passwordNueva = '';
  texto = '';

  readonly totalCatalogo = computed(() =>
    this.catalogo().reduce((n, m) => n + m.permisos.length, 0),
  );

  ngOnInit(): void {
    void this.cargar(1);
    void this.api
      .get<ModuloPermisos[]>('/api/v1/users/permisos-disponibles')
      .then((c) => this.catalogo.set(c))
      .catch((err) => this.error.set(mensajeDe(err)));
  }

  get hayFiltros(): boolean {
    return Boolean(this.texto.trim());
  }

  limpiarFiltros(): void {
    this.texto = '';
    void this.cargar(1);
  }

  readonly relleno = computed(() =>
    Array.from({ length: Math.max(0, 10 - this.pagina().items.length) }),
  );

  irAPagina(pagina: number): void {
    void this.cargar(pagina);
  }

  buscar(): void {
    void this.cargar(1);
  }

  abrirSeccion(usuario: UsuarioAcceso, seccion: 'permisos' | 'password'): void {
    const actual = this.expandido();
    if (actual?.id === usuario.id && actual.seccion === seccion) {
      this.expandido.set(null);
      return;
    }
    this.mostrarForm.set(false);
    this.expandido.set({ id: usuario.id, seccion });
    this.passwordNueva = '';
    if (seccion === 'permisos') {
      // Solo permisos reconocidos del catálogo: si la columna trae residuos
      // (p.ej. de ediciones manuales por SQL), se descartan aquí y guardar
      // deja la lista limpia — el backend rechaza cualquier valor extraño.
      const conocidos = new Set(this.catalogo().flatMap((m) => m.permisos));
      this.seleccion.set(new Set(usuario.permissions.filter((p) => conocidos.has(p))));
    }
  }

  abrirAlta(): void {
    this.expandido.set(null);
    this.forma = { email: '', password: '' };
    this.seleccionAlta.set(new Set());
    this.mostrarForm.set(true);
  }

  cerrarAlta(): void {
    this.mostrarForm.set(false);
    this.forma = { email: '', password: '' };
    this.seleccionAlta.set(new Set());
  }

  cerrarEdicion(): void {
    this.expandido.set(null);
    this.passwordNueva = '';
  }

  async crear(formulario: NgForm, evento: SubmitEvent): Promise<void> {
    const errorValidacion = validarFormulario(formulario, evento);
    if (errorValidacion) {
      this.errorForm.set(null);
      this.toast.error(errorValidacion);
      return;
    }
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      await this.api.post('/api/v1/users', {
        email: this.forma.email.trim(),
        password: this.forma.password,
        permissions: [...this.seleccionAlta()],
      });
      this.toast.ok('Usuario creado.');
      this.cerrarAlta();
      await this.cargar(this.pagina().page);
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formulario, evento, err));
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
      if (this.esYo(usuario)) {
        // Refresh silencioso: el token nuevo trae los claims actualizados y
        // el menú/los guards reaccionan al instante, sin cerrar la sesión.
        await this.auth.refrescar();
        this.toast.ok('Permisos guardados y aplicados a tu sesión al instante.');
      } else {
        this.toast.ok(
          'Permisos guardados. Se aplican solos en la siguiente renovación de su sesión (menos de 10 minutos), sin sacarlo del sistema.',
        );
      }
      this.expandido.set(null);
      await this.cargar(this.pagina().page);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async restablecerPassword(
    usuario: UsuarioAcceso,
    formulario: NgForm,
    evento: SubmitEvent,
  ): Promise<void> {
    const errorValidacion = validarFormulario(formulario, evento);
    if (errorValidacion) {
      this.errorForm.set(null);
      this.toast.error(errorValidacion);
      return;
    }
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      await this.api.patch(`/api/v1/users/${usuario.id}/password`, {
        password: this.passwordNueva,
      });
      this.toast.ok('Contraseña restablecida. Se cerraron las sesiones del usuario.');
      this.expandido.set(null);
      this.passwordNueva = '';
    } catch (err) {
      this.toast.error(presentarErrorFormulario(formulario, evento, err));
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
      await this.cargar(this.pagina().page);
    } catch (err) {
      this.toast.error(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }

  esYo(usuario: UsuarioAcceso): boolean {
    return this.auth.idUsuario() === usuario.id;
  }

  private async cargar(pagina: number): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    this.expandido.set(null);
    try {
      this.pagina.set(
        await this.api.get<Paginado<UsuarioAcceso>>('/api/v1/users', {
          page: pagina,
          limit: 10,
          buscar: this.texto.trim() || undefined,
        }),
      );
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
