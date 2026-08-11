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
import * as L from 'leaflet';
import { CatalogosService } from '../../core/catalogos.service';
import { ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';

const CENTRO_JALISCO: L.LatLngTuple = [20.6, -103.35];

/**
 * Módulo Penitenciarios: mapa general (Leaflet en blanco y negro) con un
 * punto por cada centro penitenciario del catálogo que tenga coordenadas,
 * el estado de Jalisco resaltado con su límite oficial (OSM) y el listado
 * de centros como panel flotante sobre el propio mapa.
 * Las coordenadas se administran desde Catálogos → Centros penitenciarios.
 */
@Component({
  selector: 'rw-penitenciarios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './penitenciarios.component.html',
})
export class PenitenciariosComponent implements AfterViewInit, OnDestroy {
  private readonly catalogos = inject(CatalogosService);

  @ViewChild('contenedor') private readonly contenedor!: ElementRef<HTMLDivElement>;

  readonly centros = signal<ValorCatalogo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly seleccionado = signal<string | null>(null);
  /** Panel flotante de centros dentro del mapa (colapsable). */
  readonly panelAbierto = signal(true);

  readonly conUbicacion = computed(() =>
    this.centros().filter((c) => c.latitud != null && c.longitud != null),
  );
  readonly sinUbicacion = computed(() =>
    this.centros().filter((c) => c.latitud == null || c.longitud == null),
  );

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
      const centros = await this.catalogos.listarAdministrable('centros', false);
      this.centros.set(centros);
      this.pintarMarcadores();
      this.ajustarVista();
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.cargando.set(false);
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
    const icono = L.divIcon({
      className: '',
      html: '<span class="pin-bn"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    for (const centro of this.conUbicacion()) {
      const marcador = L.marker([centro.latitud!, centro.longitud!], { icon: icono })
        .addTo(this.mapa)
        .bindPopup(
          `<strong>${escaparHtml(centro.nombre)}</strong><br/>` +
            `<span style="font-family:monospace;font-size:10px">${centro.latitud}, ${centro.longitud}</span>` +
            (centro.descripcion ? `<br/>${escaparHtml(centro.descripcion)}` : ''),
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
