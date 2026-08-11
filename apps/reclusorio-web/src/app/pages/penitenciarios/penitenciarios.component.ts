import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

const CENTRO_JALISCO: L.LatLngTuple = [20.6, -103.35];

/** Persona actualmente en un centro (respuesta de poblacion-por-centro). */
export interface PersonaEnCentro {
  idPersona: string;
  nombre: string;
  alias?: string;
  curp?: string;
  edad: number | null;
  fechaIngreso: string;
  delito?: string;
}

interface PoblacionCentro {
  idCentroPenitenciario: string;
  total: number;
  personas: PersonaEnCentro[];
}

/**
 * Módulo Penitenciarios: mapa general (Leaflet en blanco y negro) con un
 * punto por cada centro penitenciario del catálogo, el estado de Jalisco
 * resaltado con su límite oficial (OSM), la POBLACIÓN actual de cada centro
 * sobre el pin (última entrada tipo INGRESO de cada persona) y una ficha
 * con el detalle de las personas del centro seleccionado.
 */
@Component({
  selector: 'rw-penitenciarios',
  standalone: true,
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './penitenciarios.component.html',
})
export class PenitenciariosComponent implements AfterViewInit, OnDestroy {
  private readonly catalogos = inject(CatalogosService);
  private readonly api = inject(ApiService);

  @ViewChild('contenedor') private readonly contenedor!: ElementRef<HTMLDivElement>;

  readonly centros = signal<ValorCatalogo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly seleccionado = signal<string | null>(null);
  /** Panel flotante de centros dentro del mapa; inicia contraído para ver el mapa completo. */
  readonly panelAbierto = signal(false);
  /** Población por centro; null si el usuario no puede consultar personas. */
  readonly poblacion = signal<Map<string, PersonaEnCentro[]> | null>(null);

  readonly conUbicacion = computed(() =>
    this.centros().filter((c) => c.latitud != null && c.longitud != null),
  );
  readonly sinUbicacion = computed(() =>
    this.centros().filter((c) => c.latitud == null || c.longitud == null),
  );
  readonly totalPoblacion = computed(() => {
    const mapa = this.poblacion();
    if (!mapa) return 0;
    return [...mapa.values()].reduce((suma, lista) => suma + lista.length, 0);
  });
  /** Centro seleccionado con su gente, para la ficha de detalle. */
  readonly detalle = computed(() => {
    const id = this.seleccionado();
    if (!id) return null;
    const centro = this.centros().find((c) => c.id === id);
    if (!centro) return null;
    return { centro, personas: this.poblacion()?.get(id) ?? [] };
  });

  private mapa?: L.Map;
  private readonly marcadores = new Map<string, L.Marker>();

  ngAfterViewInit(): void {
    this.mapa = L.map(this.contenedor.nativeElement, {
      center: CENTRO_JALISCO,
      zoom: 8,
      attributionControl: true,
      // El panel flotante vive en la esquina superior izquierda.
      zoomControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(this.mapa);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
      className: 'tile-bn',
    }).addTo(this.mapa);
    setTimeout(() => this.mapa?.invalidateSize(), 0);
    void this.cargar();
    void this.dibujarLimiteJalisco();
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }

  conteo(idCentro: string): number {
    return this.poblacion()?.get(idCentro)?.length ?? 0;
  }

  /** Centra el mapa en un centro y abre su ficha. */
  enfocar(centro: ValorCatalogo): void {
    if (centro.latitud == null || centro.longitud == null || !this.mapa) return;
    this.seleccionado.set(centro.id);
    this.mapa.flyTo([centro.latitud, centro.longitud], 15, { duration: 0.8 });
    this.marcadores.get(centro.id)?.openPopup();
  }

  verTodos(): void {
    this.seleccionado.set(null);
    this.ajustarVista();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [centros] = await Promise.all([
        this.catalogos.listarAdministrable('centros', false),
        this.cargarPoblacion(),
      ]);
      this.centros.set(centros);
      this.pintarMarcadores();
      this.ajustarVista();
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
    }
  }

  /** La población requiere personas:consultar; sin permiso el mapa sigue útil. */
  private async cargarPoblacion(): Promise<void> {
    try {
      const datos = await this.api.get<PoblacionCentro[]>(
        '/api/v1/ingresos-egresos/poblacion-por-centro',
      );
      this.poblacion.set(new Map(datos.map((d) => [d.idCentroPenitenciario, d.personas])));
    } catch {
      this.poblacion.set(null);
    }
  }

  /**
   * Resalta el estado de Jalisco con su límite administrativo oficial
   * (polígono simplificado de OSM vía Nominatim). Es decorativo: si la
   * consulta falla, el mapa sigue funcionando sin el borde.
   */
  private async dibujarLimiteJalisco(): Promise<void> {
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?state=Jalisco&country=M%C3%A9xico' +
        '&format=jsonv2&limit=1&polygon_geojson=1&polygon_threshold=0.005';
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const [dato] = (await res.json()) as Array<{ geojson?: GeoJSON.GeoJsonObject }>;
      if (!dato?.geojson || !this.mapa) return;
      L.geoJSON(dato.geojson, {
        style: {
          color: '#22d3ee',
          weight: 2,
          opacity: 0.75,
          fillColor: '#22d3ee',
          fillOpacity: 0.035,
        },
        interactive: false,
      }).addTo(this.mapa);
    } catch {
      // Sin borde: el resto del módulo no depende de esta consulta.
    }
  }

  private pintarMarcadores(): void {
    if (!this.mapa) return;
    for (const centro of this.conUbicacion()) {
      const personas = this.conteo(centro.id);
      // Con población el pin se vuelve un contador; sin ella, punto simple.
      const icono =
        personas > 0
          ? L.divIcon({
              className: '',
              html: `<span class="pin-conteo">${personas}</span>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            })
          : L.divIcon({
              className: '',
              html: '<span class="pin-bn"></span>',
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            });
      const marcador = L.marker([centro.latitud!, centro.longitud!], { icon: icono })
        .addTo(this.mapa)
        .bindPopup(
          `<strong>${escaparHtml(centro.nombre)}</strong><br/>` +
            (this.poblacion() ? `${personas} persona(s) en el centro<br/>` : '') +
            `<span style="font-family:monospace;font-size:10px">${centro.latitud}, ${centro.longitud}</span>`,
        );
      marcador.on('click', () => this.seleccionado.set(centro.id));
      this.marcadores.set(centro.id, marcador);
    }
  }

  /** Encuadra todos los puntos; si no hay, se queda la vista estatal. */
  private ajustarVista(): void {
    const puntos = this.conUbicacion().map((c) => [c.latitud!, c.longitud!] as L.LatLngTuple);
    if (this.mapa && puntos.length > 0) {
      this.mapa.fitBounds(L.latLngBounds(puntos).pad(0.15));
    }
  }
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
