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
  templateUrl: './dashboard.component.html',
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
