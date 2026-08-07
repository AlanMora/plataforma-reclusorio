import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SessionService } from '../core/session.service';
import { RealtimeService } from '../core/realtime.service';
import { NotificacionesService } from '../core/notificaciones.service';
import { ToastService } from '../core/toast.service';

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
  { ruta: '/personas', etiqueta: 'Personas', icono: '◉', permiso: 'personas:consultar' },
  { ruta: '/elementos', etiqueta: 'Elementos', icono: '⬡', permiso: 'elementos:consultar' },
  { ruta: '/incidencias', etiqueta: 'Incidencias', icono: '▲', permiso: 'incidencias:consultar' },
  { ruta: '/catalogos', etiqueta: 'Catálogos', icono: '≡', permiso: 'catalogos:administrar' },
  { ruta: '/notificaciones', etiqueta: 'Notificaciones', icono: '◎' },
  { ruta: '/cuenta', etiqueta: 'Mi cuenta', icono: '□' },
];

@Component({
  selector: 'rw-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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

  readonly menuVisible = computed(() =>
    MENU.filter((item) => !item.permiso || this.auth.permisos().includes(item.permiso)),
  );

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
