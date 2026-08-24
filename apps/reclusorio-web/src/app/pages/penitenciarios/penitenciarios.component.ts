import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import mapboxgl from 'mapbox-gl';
import { ApiService } from '../../core/api.service';
import { CatalogosService } from '../../core/catalogos.service';
import { obtenerTokenMapbox } from '../../core/mapbox-config';
import { Paginado, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { IconoComponent } from '../../shared/icono.component';

const CENTRO_JALISCO: [number, number] = [-103.35, 20.6];
const FUENTE_LIMITE_JALISCO = 'limite-jalisco';
const CAPA_LIMITE_JALISCO_RELLENO = 'limite-jalisco-relleno';
const CAPA_LIMITE_JALISCO_RESPLANDOR = 'limite-jalisco-resplandor';
const CAPA_LIMITE_JALISCO = 'limite-jalisco-trazo';

/**
 * Contorno estatal MX-JAL simplificado a partir de mexicoHigh. Se sirve
 * localmente: no agrega una segunda API ni consume geocodificación.
 */
const CONTORNO_JALISCO: [number, number][] = [
  [-102.775, 21.688], [-102.661, 21.369], [-103.087, 21.063], [-103.356, 20.999],
  [-103.599, 21.071], [-103.573, 21.292], [-103.706, 21.477], [-103.564, 21.723],
  [-103.166, 21.961], [-103.088, 22.177], [-103.202, 22.322], [-103.496, 22.042],
  [-103.699, 22.082], [-103.548, 22.311], [-103.683, 22.494], [-104.197, 22.394],
  [-104.352, 22.049], [-103.951, 21.715], [-103.81, 21.5], [-103.817, 21.287],
  [-104.229, 21.138], [-104.289, 20.819], [-104.851, 20.995], [-105.138, 20.892],
  [-105.296, 20.693], [-105.319, 20.515], [-105.695, 20.41], [-105.555, 20.227],
  [-105.505, 20.011], [-105.265, 19.683], [-105.089, 19.56], [-105.032, 19.39],
  [-104.68, 19.201], [-104.422, 19.307], [-103.844, 19.406], [-103.59, 19.556],
  [-103.455, 18.973], [-103.193, 18.96], [-102.881, 19.208], [-102.733, 19.213],
  [-102.598, 19.422], [-102.766, 19.478], [-102.818, 19.902], [-103.095, 19.96],
  [-102.995, 20.152], [-102.854, 20.086], [-102.452, 20.323], [-102.066, 20.369],
  [-101.98, 20.602], [-102.134, 20.764], [-101.797, 21.156], [-101.547, 21.845],
  [-101.896, 21.89], [-102.169, 21.684], [-102.368, 21.625], [-102.525, 21.715],
  [-102.775, 21.688],
];

function estaDentroDeJalisco(longitud: number, latitud: number): boolean {
  let dentro = false;
  for (let i = 0, j = CONTORNO_JALISCO.length - 1; i < CONTORNO_JALISCO.length; j = i++) {
    const [xi, yi] = CONTORNO_JALISCO[i];
    const [xj, yj] = CONTORNO_JALISCO[j];
    const cruza =
      yi > latitud !== yj > latitud &&
      longitud < ((xj - xi) * (latitud - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Incidencia con el detalle mostrado en la ficha del centro. */
interface IncidenciaMapa {
  idIncidencia: string;
  idCentroPenitenciario: string;
  fecha: string;
  idTipoIncidencia: string;
  descripcion: string;
  iph?: string;
  primerRespondiente?: string;
  narrativa?: string;
  estadoRevision: string;
}

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
 * Módulo Penitenciarios: mapa general Mapbox con un punto por cada centro
 * penitenciario del catálogo, la POBLACIÓN actual de cada centro
 * sobre el pin (última entrada tipo INGRESO de cada persona) y una ficha
 * con el detalle de las personas del centro seleccionado.
 */
@Component({
  selector: 'rw-penitenciarios',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './penitenciarios.component.html',
})
export class PenitenciariosComponent implements AfterViewInit, OnDestroy {
  private readonly catalogos = inject(CatalogosService);
  private readonly api = inject(ApiService);
  private readonly zone = inject(NgZone);
  private readonly tokenMapbox = obtenerTokenMapbox();

  private readonly contenedor = viewChild.required<ElementRef<HTMLDivElement>>('contenedor');

  readonly centros = signal<ValorCatalogo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly introduccionMapa = signal(true);
  readonly seleccionado = signal<string | null>(null);
  /** Panel flotante de centros dentro del mapa; inicia contraído para ver el mapa completo. */
  readonly panelAbierto = signal(false);
  /** Población por centro; null si el usuario no puede consultar personas. */
  readonly poblacion = signal<Map<string, PersonaEnCentro[]> | null>(null);
  /** Pestaña activa de la ficha del centro. */
  readonly fichaTab = signal<'poblacion' | 'incidencias'>('poblacion');
  /** Incidencias del centro seleccionado; null mientras carga o sin permiso. */
  readonly incidenciasCentro = signal<IncidenciaMapa[] | null>(null);

  readonly conUbicacion = computed(() =>
    this.centros().filter(
      (c) =>
        c.latitud != null &&
        c.longitud != null &&
        estaDentroDeJalisco(c.longitud, c.latitud),
    ),
  );
  readonly fueraDeJalisco = computed(() =>
    this.centros().filter(
      (c) =>
        c.latitud != null &&
        c.longitud != null &&
        !estaDentroDeJalisco(c.longitud, c.latitud),
    ),
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

  private mapa?: mapboxgl.Map;
  private resizeObserver?: ResizeObserver;
  private temporizadorIntro?: number;
  private readonly marcadores = new Map<string, mapboxgl.Marker>();
  /** Nombres de catálogo para mostrar en la ficha del centro. */
  private mapaTiposIncidencia = new Map<string, string>();

  ngAfterViewInit(): void {
    if (!this.tokenMapbox) {
      this.error.set('No se configuró el token público de Mapbox para este entorno.');
      void this.cargar();
      return;
    }

    this.mapa = new mapboxgl.Map({
      accessToken: this.tokenMapbox,
      container: this.contenedor().nativeElement,
      style: 'mapbox://styles/mapbox/standard',
      config: {
        basemap: {
          theme: 'monochrome',
          lightPreset: 'night',
          showPointOfInterestLabels: false,
          showTransitLabels: false,
          show3dObjects: true,
        },
      },
      projection: 'globe',
      center: [-103.35, 21.2],
      zoom: 1.15,
      pitch: 0,
      bearing: -18,
      antialias: true,
      attributionControl: false,
    });
    this.mapa.addControl(
      new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right',
    );
    this.mapa.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    this.mapa.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    this.bloquearInteraccionMapa();
    this.mapa.once('load', () => {
      this.prepararEscenaJalisco();
      this.temporizadorIntro = window.setTimeout(() => this.volarAJalisco(), 650);
    });
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.mapa?.resize());
      this.resizeObserver.observe(this.contenedor().nativeElement);
    });
    void this.cargar();
  }

  ngOnDestroy(): void {
    if (this.temporizadorIntro !== undefined) window.clearTimeout(this.temporizadorIntro);
    this.resizeObserver?.disconnect();
    for (const marcador of this.marcadores.values()) marcador.remove();
    this.marcadores.clear();
    this.mapa?.remove();
  }

  conteo(idCentro: string): number {
    return this.poblacion()?.get(idCentro)?.length ?? 0;
  }

  /** Centra el mapa en un centro y abre su ficha flotante. */
  enfocar(centro: ValorCatalogo): void {
    if (centro.latitud == null || centro.longitud == null || !this.mapa) return;
    this.seleccionar(centro.id);
    this.mapa.flyTo({
      center: [centro.longitud, centro.latitud],
      zoom: 15,
      pitch: 52,
      bearing: -12,
      speed: 1.2,
      essential: true,
    });
  }

  /** Selecciona un centro y carga sus incidencias para la ficha. */
  seleccionar(id: string): void {
    this.seleccionado.set(id);
    this.fichaTab.set('poblacion');
    void this.cargarIncidenciasCentro(id);
  }

  /** Incidencias del centro para la ficha; null si falta el permiso. */
  private async cargarIncidenciasCentro(id: string): Promise<void> {
    this.incidenciasCentro.set(null);
    try {
      const pagina = await this.api.get<Paginado<IncidenciaMapa>>('/api/v1/incidencias', {
        page: 1,
        limit: 10,
        idCentroPenitenciario: id,
      });
      this.incidenciasCentro.set(pagina.items);
    } catch {
      this.incidenciasCentro.set(null);
    }
  }

  nombreTipoIncidencia(id: string): string {
    return this.mapaTiposIncidencia.get(id) ?? '…';
  }
  verTodos(): void {
    this.seleccionado.set(null);
    this.ajustarVista();
  }

  /** Agrega el límite local de Jalisco y la atmósfera de la vista global. */
  private prepararEscenaJalisco(): void {
    if (!this.mapa) return;
    this.mapa.setFog({
      color: 'rgb(15, 32, 52)',
      'high-color': 'rgb(8, 29, 58)',
      'horizon-blend': 0.08,
      'space-color': 'rgb(1, 4, 12)',
      'star-intensity': 0.65,
    });
    this.mapa.addSource(FUENTE_LIMITE_JALISCO, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: { nombre: 'Jalisco' },
        geometry: { type: 'Polygon', coordinates: [CONTORNO_JALISCO] },
      },
    });
    this.mapa.addLayer({
      id: CAPA_LIMITE_JALISCO_RELLENO,
      type: 'fill',
      source: FUENTE_LIMITE_JALISCO,
      slot: 'top',
      paint: {
        'fill-color': '#f97316',
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.06, 8, 0.16],
      },
    });
    this.mapa.addLayer({
      id: CAPA_LIMITE_JALISCO_RESPLANDOR,
      type: 'line',
      source: FUENTE_LIMITE_JALISCO,
      slot: 'top',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#fb6a00',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 22],
        'line-opacity': 0.72,
        'line-blur': 7,
        'line-emissive-strength': 1,
      },
    });
    this.mapa.addLayer({
      id: CAPA_LIMITE_JALISCO,
      type: 'line',
      source: FUENTE_LIMITE_JALISCO,
      slot: 'top',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#fde047',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 8, 4.5],
        'line-opacity': 1,
        'line-emissive-strength': 1,
      },
    });
  }

  /** Vuelo de presentación: planeta completo → red penitenciaria de Jalisco. */
  private volarAJalisco(): void {
    if (!this.mapa) return;
    this.mapa.flyTo({
      center: CENTRO_JALISCO,
      zoom: 7.35,
      pitch: 38,
      bearing: -8,
      duration: 4_200,
      curve: 1.42,
      speed: 0.8,
      essential: false,
    });
    this.mapa.once('moveend', () => {
      this.zone.run(() => {
        this.introduccionMapa.set(false);
        this.habilitarInteraccionMapa();
        this.pintarMarcadores();
      });
    });
  }

  private bloquearInteraccionMapa(): void {
    this.mapa?.boxZoom.disable();
    this.mapa?.doubleClickZoom.disable();
    this.mapa?.dragPan.disable();
    this.mapa?.dragRotate.disable();
    this.mapa?.keyboard.disable();
    this.mapa?.scrollZoom.disable();
    this.mapa?.touchZoomRotate.disable();
  }

  private habilitarInteraccionMapa(): void {
    this.mapa?.boxZoom.enable();
    this.mapa?.doubleClickZoom.enable();
    this.mapa?.dragPan.enable();
    this.mapa?.dragRotate.enable();
    this.mapa?.keyboard.enable();
    this.mapa?.scrollZoom.enable();
    this.mapa?.touchZoomRotate.enable();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [centros] = await Promise.all([
        this.catalogos.listarAdministrable('centros', false),
        this.cargarPoblacion(),
        this.cargarCatalogoIncidencias(),
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

  /** Nombre del tipo usado en la ficha de incidencias del centro. */
  private async cargarCatalogoIncidencias(): Promise<void> {
    try {
      this.mapaTiposIncidencia = await this.catalogos.mapa('tipo_incidencia');
    } catch {
      // La ficha sigue funcionando y muestra un marcador neutro.
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

  private pintarMarcadores(): void {
    if (!this.mapa || this.introduccionMapa()) return;
    for (const marcador of this.marcadores.values()) marcador.remove();
    this.marcadores.clear();
    for (const centro of this.conUbicacion()) {
      const conteo = this.conteo(centro.id);
      const elemento = document.createElement('button');
      elemento.type = 'button';
      elemento.className =
        'mapbox-pin-centro' +
        (conteo > 0 ? ' mapbox-pin-centro--conteo' : '');
      elemento.title = centro.nombre;
      elemento.setAttribute(
        'aria-label',
        `${centro.nombre}: ${conteo} personas`,
      );
      const pulso = document.createElement('span');
      pulso.className = 'mapbox-pin-centro__pulso';
      const nucleo = document.createElement('span');
      nucleo.className = 'mapbox-pin-centro__nucleo';
      if (conteo > 0) nucleo.textContent = String(conteo);
      elemento.append(pulso, nucleo);
      elemento.addEventListener('click', (evento) => {
        evento.stopPropagation();
        this.zone.run(() => this.seleccionar(centro.id));
      });
      const marcador = new mapboxgl.Marker({ element: elemento, anchor: 'center' })
        .setLngLat([centro.longitud!, centro.latitud!])
        .addTo(this.mapa);
      this.marcadores.set(centro.id, marcador);
    }
  }

  /** Encuadra todos los puntos; si no hay, se queda la vista estatal. */
  private ajustarVista(): void {
    const puntos = this.conUbicacion().map(
      (c) => [c.longitud!, c.latitud!] as [number, number],
    );
    if (this.mapa && puntos.length > 0 && !this.introduccionMapa()) {
      const limites = new mapboxgl.LngLatBounds(puntos[0], puntos[0]);
      for (const punto of puntos.slice(1)) limites.extend(punto);
      this.mapa.fitBounds(limites, { padding: 90, maxZoom: 11, duration: 850 });
    }
  }
}
