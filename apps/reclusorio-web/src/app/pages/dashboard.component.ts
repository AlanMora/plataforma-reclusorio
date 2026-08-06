import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SessionService } from '../core/session.service';

interface Modulo {
  ruta: string;
  titulo: string;
  descripcion: string;
  icono: string;
  permiso?: string;
}

const MODULOS: Modulo[] = [
  {
    ruta: '/personas',
    titulo: 'Personas',
    descripcion: 'Búsqueda, expediente, domicilios y actividades',
    icono: '◉',
    permiso: 'personas:consultar',
  },
  {
    ruta: '/elementos',
    titulo: 'Elementos',
    descripcion: 'Padrón con búsqueda previa y alta condicionada',
    icono: '⬡',
    permiso: 'elementos:consultar',
  },
  {
    ruta: '/incidencias',
    titulo: 'Incidencias',
    descripcion: 'Registro independiente y asociaciones',
    icono: '▲',
    permiso: 'incidencias:consultar',
  },
  {
    ruta: '/catalogos',
    titulo: 'Catálogos',
    descripcion: 'Administrables y fijos del modelo de datos',
    icono: '≡',
    permiso: 'catalogos:administrar',
  },
  {
    ruta: '/notificaciones',
    titulo: 'Notificaciones',
    descripcion: 'Bandeja personal con búsqueda y paginación',
    icono: '◎',
  },
  {
    ruta: '/cuenta',
    titulo: 'Mi cuenta',
    descripcion: 'Sesión, permisos y cambio de contraseña',
    icono: '□',
  },
];

@Component({
  selector: 'rw-dashboard',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-6xl space-y-8">
      <div>
        <p class="etiqueta">Panel de control</p>
        <h2 class="mt-1 text-2xl font-bold text-slate-100">
          Bienvenido, <span class="text-neon">{{ auth.email() }}</span>
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          Tienes {{ auth.permisos().length }} permiso(s) activos. El menú y los módulos
          visibles se construyen con ellos.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (m of visibles(); track m.ruta) {
          <a class="panel group p-5 transition hover:border-neon/40" [routerLink]="m.ruta">
            <span class="text-2xl text-neon/70 transition group-hover:text-neon">{{ m.icono }}</span>
            <h3 class="mt-3 font-semibold text-slate-100">{{ m.titulo }}</h3>
            <p class="mt-1 text-sm text-slate-500">{{ m.descripcion }}</p>
          </a>
        }
      </div>

      <div class="panel p-5">
        <p class="etiqueta">Estado de la sesión</p>
        <div class="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <p class="font-mono text-2xl text-neon">{{ minutosRestantes() }}</p>
            <p class="text-xs text-slate-500">minutos restantes (30 min renovables, RF-SES-002)</p>
          </div>
          <div>
            <p class="font-mono text-2xl text-slate-200">{{ auth.roles().join(', ') || '—' }}</p>
            <p class="text-xs text-slate-500">roles</p>
          </div>
          <div>
            <p class="truncate font-mono text-2xl text-slate-200" [title]="auth.sid() ?? ''">
              {{ (auth.sid() ?? '—').slice(0, 8) }}
            </p>
            <p class="text-xs text-slate-500">identificador de sesión</p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);

  readonly visibles = computed(() =>
    MODULOS.filter((m) => !m.permiso || this.auth.permisos().includes(m.permiso)),
  );

  readonly minutosRestantes = computed(() => {
    const s = this.session.restante();
    return s === null ? '—' : String(Math.max(Math.ceil(s / 60), 0));
  });
}
