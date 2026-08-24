import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideBadge,
  LucideBell,
  LucideBuilding2,
  LucideCalendarDays,
  LucideChartNoAxesColumn,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideCircleUserRound,
  LucideClock3,
  LucideDownload,
  LucideDynamicIcon,
  LucideEye,
  LucideFileText,
  LucideGrid2x2,
  LucideInfo,
  LucideLayoutDashboard,
  LucideLibraryBig,
  LucideLoaderCircle,
  LucideLocateFixed,
  LucideLock,
  LucideLogIn,
  LucideLogOut,
  LucideMapPin,
  LucideMenu,
  LucideMic,
  LucideMinus,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSave,
  LucideSearch,
  LucideSend,
  LucideShieldCheck,
  LucideSiren,
  LucideSquare,
  LucideTrash2,
  LucideUpload,
  LucideUserCog,
  LucideUsersRound,
  LucideVolume2,
  LucideVolumeX,
  LucideX,
  type LucideIcon,
} from '@lucide/angular';

const ICONOS = {
  agregar: LucidePlus,
  anterior: LucideChevronLeft,
  alerta: LucideCircleAlert,
  archivo: LucideFileText,
  atras: LucideArrowLeft,
  buscar: LucideSearch,
  calendario: LucideCalendarDays,
  catalogos: LucideLibraryBig,
  centro: LucideBuilding2,
  cerrar: LucideX,
  correcto: LucideCircleCheck,
  cuenta: LucideCircleUserRound,
  descargar: LucideDownload,
  detener: LucideSquare,
  editar: LucidePencil,
  elementos: LucideBadge,
  eliminar: LucideTrash2,
  entrar: LucideLogIn,
  guardar: LucideSave,
  incidencias: LucideSiren,
  informacion: LucideInfo,
  localizar: LucideLocateFixed,
  lock: LucideLock,
  mapa: LucideMapPin,
  menu: LucideMenu,
  menos: LucideMinus,
  microfono: LucideMic,
  notificaciones: LucideBell,
  panel: LucideLayoutDashboard,
  reportes: LucideChartNoAxesColumn,
  revisar: LucideEye,
  recargar: LucideRefreshCw,
  salir: LucideLogOut,
  seguridad: LucideShieldCheck,
  seleccionar: LucideChevronDown,
  siguiente: LucideChevronRight,
  subir: LucideUpload,
  temporizador: LucideClock3,
  usuarios: LucideUsersRound,
  configuracion_usuario: LucideUserCog,
  cuadricula: LucideGrid2x2,
  enviar: LucideSend,
  volumen: LucideVolume2,
  silencio: LucideVolumeX,
  cargando: LucideLoaderCircle,
  flecha_derecha: LucideArrowRight,
} as const satisfies Record<string, LucideIcon>;

export type NombreIcono = keyof typeof ICONOS;

/**
 * Fachada única para la iconografía del producto. Mantiene tamaño, trazo y
 * accesibilidad consistentes sin cargar el catálogo completo de Lucide.
 */
@Component({
  selector: 'rw-icono',
  standalone: true,
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0 items-center justify-center align-middle leading-none',
    '[class.animate-spin]': "nombre() === 'cargando'",
    'aria-hidden': 'true',
  },
  template: `
    <svg
      [lucideIcon]="icono()"
      [size]="tamano()"
      [strokeWidth]="grosor()"
      [absoluteStrokeWidth]="true"
    ></svg>
  `,
})
export class IconoComponent {
  readonly nombre = input.required<NombreIcono>();
  readonly tamano = input(17);
  readonly grosor = input(1.8);
  protected readonly icono = computed(() => ICONOS[this.nombre()]);
}
