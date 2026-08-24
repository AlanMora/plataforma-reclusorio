import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CatalogosService } from '../core/catalogos.service';
import { NotificacionesService } from '../core/notificaciones.service';
import { Paginado } from '../core/models';
import { SessionService } from '../core/session.service';
import { IconoComponent, NombreIcono } from '../shared/icono.component';

interface Modulo {
  ruta: string;
  titulo: string;
  icono: NombreIcono;
  permiso?: string;
}

interface Metrica {
  etiqueta: string;
  detalle: string;
  valor: number | string | null;
  icono: NombreIcono;
  ruta: string;
  tono: 'neon' | 'ok' | 'alerta';
  permiso?: string;
}

interface PoblacionCentro {
  total: number;
}

const MODULOS: Modulo[] = [
  { ruta: '/personas', titulo: 'Personas', icono: 'usuarios', permiso: 'personas:consultar' },
  {
    ruta: '/penitenciarios',
    titulo: 'Mapa penitenciario',
    icono: 'centro',
  },
  {
    ruta: '/incidencias',
    titulo: 'Incidencias',
    icono: 'incidencias',
    permiso: 'incidencias:consultar',
  },
  {
    ruta: '/elementos',
    titulo: 'Elementos',
    icono: 'elementos',
    permiso: 'elementos:consultar',
  },
  { ruta: '/reportes', titulo: 'Reportes', icono: 'reportes', permiso: 'personas:consultar' },
  { ruta: '/notificaciones', titulo: 'Notificaciones', icono: 'notificaciones' },
];

@Component({
  selector: 'rw-dashboard',
  standalone: true,
  imports: [RouterLink, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly catalogos = inject(CatalogosService);
  readonly auth = inject(AuthService);
  readonly notificaciones = inject(NotificacionesService);
  private readonly session = inject(SessionService);

  readonly cargando = signal(true);
  readonly totalPersonas = signal<number | null>(null);
  readonly poblacionActual = signal<number | null>(null);
  readonly totalIncidencias = signal<number | null>(null);
  readonly totalElementos = signal<number | null>(null);
  readonly totalCentros = signal<number | null>(null);

  readonly visibles = computed(() =>
    MODULOS.filter((m) => !m.permiso || this.tienePermiso(m.permiso)),
  );

  readonly metricas = computed<Metrica[]>(() => {
    const metricas: Metrica[] = [
      {
        etiqueta: 'Personas registradas',
        detalle: 'Expedientes en el padrón',
        valor: this.totalPersonas(),
        icono: 'usuarios',
        ruta: '/personas',
        tono: 'neon',
        permiso: 'personas:consultar',
      },
      {
        etiqueta: 'Población actual',
        detalle: 'Personas dentro de centros',
        valor: this.poblacionActual(),
        icono: 'centro',
        ruta: '/penitenciarios',
        tono: 'ok',
        permiso: 'personas:consultar',
      },
      {
        etiqueta: 'Incidencias',
        detalle: 'Registros acumulados',
        valor: this.totalIncidencias(),
        icono: 'incidencias',
        ruta: '/incidencias',
        tono: 'alerta',
        permiso: 'incidencias:consultar',
      },
      {
        etiqueta: 'Elementos',
        detalle: 'Integrantes del padrón',
        valor: this.totalElementos(),
        icono: 'elementos',
        ruta: '/elementos',
        tono: 'neon',
        permiso: 'elementos:consultar',
      },
      {
        etiqueta: 'Centros activos',
        detalle: 'Red penitenciaria configurada',
        valor: this.totalCentros(),
        icono: 'mapa',
        ruta: '/penitenciarios',
        tono: 'ok',
      },
      {
        etiqueta: 'Sin leer',
        detalle: 'Notificaciones pendientes',
        valor: this.notificaciones.noLeidas(),
        icono: 'notificaciones',
        ruta: '/notificaciones',
        tono: 'alerta',
      },
    ];
    return metricas.filter((m) => !m.permiso || this.tienePermiso(m.permiso));
  });

  readonly minutosRestantes = computed(() => {
    const segundos = this.session.restante();
    return segundos === null ? '—' : String(Math.max(Math.ceil(segundos / 60), 0));
  });

  ngOnInit(): void {
    void this.cargarMetricas();
  }

  private tienePermiso(permiso: string): boolean {
    return this.auth.permisos().includes(permiso);
  }

  private async cargarMetricas(): Promise<void> {
    this.cargando.set(true);
    const tareas: Promise<unknown>[] = [
      this.catalogos
        .valores('centros')
        .then((centros) => this.totalCentros.set(centros.length))
        .catch(() => this.totalCentros.set(null)),
    ];

    if (this.tienePermiso('personas:consultar')) {
      tareas.push(
        this.api
          .get<Paginado<unknown>>('/api/v1/personas', { page: 1, limit: 1 })
          .then((pagina) => this.totalPersonas.set(pagina.total))
          .catch(() => this.totalPersonas.set(null)),
        this.api
          .get<PoblacionCentro[]>('/api/v1/ingresos-egresos/poblacion-por-centro')
          .then((centros) =>
            this.poblacionActual.set(centros.reduce((total, centro) => total + centro.total, 0)),
          )
          .catch(() => this.poblacionActual.set(null)),
      );
    }

    if (this.tienePermiso('incidencias:consultar')) {
      tareas.push(
        this.api
          .get<Paginado<unknown>>('/api/v1/incidencias', { page: 1, limit: 1 })
          .then((pagina) => this.totalIncidencias.set(pagina.total))
          .catch(() => this.totalIncidencias.set(null)),
      );
    }

    if (this.tienePermiso('elementos:consultar')) {
      tareas.push(
        this.api
          .get<Paginado<unknown>>('/api/v1/elementos', { page: 1, limit: 1 })
          .then((pagina) => this.totalElementos.set(pagina.total))
          .catch(() => this.totalElementos.set(null)),
      );
    }

    await Promise.allSettled(tareas);
    this.cargando.set(false);
  }
}
