import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

/** Domicilio desarmado por el geocodificador + coordenadas del marcador. */
export interface DomicilioGeocodificado {
  calle: string;
  numeroExterior: string;
  colonia: string;
  municipio: string;
  estado: string;
  pais: string;
  latitud: number;
  longitud: number;
}

interface ResultadoNominatim {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const CENTRO_MEXICO: L.LatLngTuple = [23.6345, -102.5528];

/** Traduce el objeto `address` de Nominatim a los campos del modelo. */
function desarmarDireccion(r: ResultadoNominatim): DomicilioGeocodificado {
  const a = r.address ?? {};
  return {
    calle: a['road'] ?? a['pedestrian'] ?? a['footway'] ?? a['street'] ?? '',
    numeroExterior: a['house_number'] ?? '',
    colonia:
      a['neighbourhood'] ?? a['suburb'] ?? a['quarter'] ?? a['residential'] ?? a['borough'] ?? '',
    municipio: a['city'] ?? a['town'] ?? a['village'] ?? a['municipality'] ?? a['county'] ?? '',
    estado: a['state'] ?? a['region'] ?? a['state_district'] ?? '',
    pais: a['country'] ?? '',
    latitud: Number(r.lat),
    longitud: Number(r.lon),
  };
}

/**
 * Mapa de ubicación del domicilio (Leaflet + OSM en blanco y negro).
 * El usuario escribe la dirección completa, elige una coincidencia y el
 * componente emite los campos desarmados + latitud/longitud; también puede
 * afinar la posición haciendo clic sobre el mapa (geocodificación inversa).
 */
@Component({
  selector: 'rw-mapa-domicilio',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mapa-domicilio.component.html',
})
export class MapaDomicilioComponent implements AfterViewInit, OnDestroy {
  /** Coordenadas iniciales del marcador (p. ej. un domicilio ya guardado). */
  readonly lat = input<number | null>(null);
  readonly lng = input<number | null>(null);
  /** En falso solo muestra el marcador, sin buscador ni clic (visor). */
  readonly interactivo = input(true);

  readonly domicilio = output<DomicilioGeocodificado>();

  @ViewChild('contenedor') private readonly contenedor!: ElementRef<HTMLDivElement>;

  consulta = '';
  readonly buscando = signal(false);
  readonly resultados = signal<ResultadoNominatim[]>([]);
  readonly errorBusqueda = signal<string | null>(null);

  private mapa?: L.Map;
  private marcador?: L.Marker;
  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;
  private abortadorBusqueda?: AbortController;

  ngAfterViewInit(): void {
    const inicial: L.LatLngTuple =
      this.lat() != null && this.lng() != null ? [this.lat()!, this.lng()!] : CENTRO_MEXICO;
    const conMarcador = this.lat() != null && this.lng() != null;

    this.mapa = L.map(this.contenedor.nativeElement, {
      center: inicial,
      zoom: conMarcador ? 16 : 5,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
      // La clase aplica el filtro de escala de grises (tema blanco y negro).
      className: 'tile-bn',
    }).addTo(this.mapa);

    if (conMarcador) this.ponerMarcador(inicial[0], inicial[1]);
    if (this.interactivo()) {
      this.mapa.on(
        'click',
        (e: L.LeafletMouseEvent) => void this.geocodificarInverso(e.latlng.lat, e.latlng.lng),
      );
    }
    // El contenedor se monta dentro de paneles que recién se despliegan.
    setTimeout(() => this.mapa?.invalidateSize(), 0);
  }

  ngOnDestroy(): void {
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    this.abortadorBusqueda?.abort();
    this.mapa?.remove();
  }

  /**
   * Autocompletado: busca solo mientras se teclea, con debounce para respetar
   * el límite de uso de Nominatim (~1 solicitud/segundo).
   */
  alTeclear(): void {
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    this.errorBusqueda.set(null);
    if (this.consulta.trim().length < 3) {
      this.resultados.set([]);
      return;
    }
    this.temporizadorBusqueda = setTimeout(() => void this.buscar(), 450);
  }

  cerrarResultados(): void {
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    this.resultados.set([]);
  }

  async buscar(): Promise<void> {
    const q = this.consulta.trim();
    if (!q) return;
    this.abortadorBusqueda?.abort();
    const abortador = new AbortController();
    this.abortadorBusqueda = abortador;
    this.buscando.set(true);
    this.errorBusqueda.set(null);
    try {
      const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&accept-language=es&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: abortador.signal,
      });
      if (!res.ok) throw new Error(`Nominatim respondió ${res.status}`);
      const datos = (await res.json()) as ResultadoNominatim[];
      // Nominatim puede regresar entradas con la misma dirección visible.
      const unicos = datos.filter(
        (r, i, arr) => arr.findIndex((x) => x.display_name === r.display_name) === i,
      );
      if (unicos.length === 0) {
        this.errorBusqueda.set('Sin coincidencias; intente con calle, número, municipio y estado.');
      }
      this.resultados.set(unicos);
      this.buscando.set(false);
    } catch (err) {
      // Una búsqueda más reciente canceló esta: no tocar el estado.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      this.errorBusqueda.set('No se pudo consultar el servicio de mapas; intente de nuevo.');
      this.buscando.set(false);
    }
  }

  elegir(r: ResultadoNominatim): void {
    this.abortadorBusqueda?.abort();
    this.cerrarResultados();
    this.buscando.set(false);
    this.consulta = r.display_name;
    const dom = desarmarDireccion(r);
    this.irA(dom.latitud, dom.longitud);
    this.domicilio.emit(dom);
  }

  private async geocodificarInverso(lat: number, lng: number): Promise<void> {
    this.irA(lat, lng);
    try {
      const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Nominatim respondió ${res.status}`);
      const dato = (await res.json()) as ResultadoNominatim;
      this.domicilio.emit({ ...desarmarDireccion(dato), latitud: lat, longitud: lng });
    } catch {
      // Sin dirección inversa se conservan las coordenadas elegidas a mano.
      this.domicilio.emit({
        calle: '',
        numeroExterior: '',
        colonia: '',
        municipio: '',
        estado: '',
        pais: '',
        latitud: lat,
        longitud: lng,
      });
    }
  }

  private irA(lat: number, lng: number): void {
    this.ponerMarcador(lat, lng);
    this.mapa?.setView([lat, lng], Math.max(this.mapa.getZoom(), 16));
  }

  private ponerMarcador(lat: number, lng: number): void {
    if (!this.mapa) return;
    // Pin dibujado con CSS (divIcon): evita los PNG de Leaflet y respeta el
    // tema blanco y negro.
    const icono = L.divIcon({
      className: '',
      html: '<span class="pin-bn"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    if (this.marcador) this.marcador.setLatLng([lat, lng]);
    else this.marcador = L.marker([lat, lng], { icon: icono, keyboard: false }).addTo(this.mapa);
  }
}
