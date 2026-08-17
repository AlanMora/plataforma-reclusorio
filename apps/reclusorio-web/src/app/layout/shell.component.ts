import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { SessionService } from '../core/session.service';
import { RealtimeService } from '../core/realtime.service';
import { NotificacionesService } from '../core/notificaciones.service';
import { ToastService } from '../core/toast.service';
import { CATALOGOS_ADMINISTRABLES, CATALOGOS_FIJOS } from '../core/catalogos.service';
import { CampanaComponent } from './campana.component';

interface ItemMenu {
  ruta: string;
  etiqueta: string;
  icono: string;
  permiso?: string;
  exacto?: boolean;
}

/** El menú se construye con los permisos del JWT (RF-SEG-001, RF-UI). */
const MENU: ItemMenu[] = [
  { ruta: '/', etiqueta: 'Panel', icono: '◈', exacto: true },
  { ruta: '/penitenciarios', etiqueta: 'Penitenciarios', icono: '⌖' },
  { ruta: '/personas', etiqueta: 'Personas', icono: '◉', permiso: 'personas:consultar' },
  { ruta: '/incidencias', etiqueta: 'Incidencias', icono: '▲', permiso: 'incidencias:consultar' },
  { ruta: '/elementos', etiqueta: 'Elementos', icono: '⬡', permiso: 'elementos:consultar' },
  { ruta: '/reportes', etiqueta: 'Reportes', icono: '▤', permiso: 'personas:consultar' },
  { ruta: '/catalogos', etiqueta: 'Catálogos', icono: '≡', permiso: 'catalogos:administrar' },
  { ruta: '/usuarios', etiqueta: 'Usuarios', icono: '♟', permiso: 'users:read' },
  { ruta: '/notificaciones', etiqueta: 'Notificaciones', icono: '◎' },
  { ruta: '/cuenta', etiqueta: 'Mi cuenta', icono: '□' },
];

@Component({
  selector: 'rw-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CampanaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly session = inject(SessionService);
  readonly notificaciones = inject(NotificacionesService);
  readonly toast = inject(ToastService);
  // Se inyecta para activar la escucha de revocación (RF-SES-009).
  private readonly realtime = inject(RealtimeService);

  private readonly router = inject(Router);

  readonly menuVisible = computed(() =>
    MENU.filter((item) => !item.permiso || this.auth.permisos().includes(item.permiso)),
  );

  private readonly urlActual = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  // --- Árbol de catálogos: Catálogos → (Administrables | Fijos) → slug ---
  readonly catalogosAdministrables = CATALOGOS_ADMINISTRABLES;
  readonly catalogosFijos = CATALOGOS_FIJOS;
  readonly catalogosAbierto = signal(false);
  readonly administrablesAbierto = signal(false);
  readonly fijosAbierto = signal(false);

  constructor() {
    // Navegar a un catálogo (o recargar en uno) deja el árbol desplegado.
    effect(() => {
      const url = this.urlActual();
      if (url.startsWith('/catalogos')) {
        this.catalogosAbierto.set(true);
        if (url.startsWith('/catalogos/administrables')) this.administrablesAbierto.set(true);
        if (url.startsWith('/catalogos/fijos')) this.fijosAbierto.set(true);
      }
    });
  }

  esCatalogos(item: ItemMenu): boolean {
    return item.ruta === '/catalogos';
  }

  /** Título de la sección actual para la barra superior. */
  readonly tituloPagina = computed(() => {
    const url = this.urlActual();
    if (url === '/' || url === '') return 'Panel de control';
    return (
      MENU.find((item) => item.ruta !== '/' && url.startsWith(item.ruta))?.etiqueta ?? 'Consola'
    );
  });

  readonly inicialUsuario = computed(() => (this.auth.email()?.[0] ?? '?').toUpperCase());

  readonly cuentaRegresiva = computed(() => {
    const s = this.session.restante();
    if (s === null) return '--:--';
    const total = Math.max(s, 0);
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  });

  readonly claseSesion = computed(() => {
    const s = this.session.restante();
    if (s === null) return 'chip-apagado';
    if (s <= 300) return 'chip-alerta';
    return 'chip-neon';
  });
}
