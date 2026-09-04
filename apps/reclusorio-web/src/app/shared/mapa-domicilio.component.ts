import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import mapboxgl, { MapMouseEvent } from 'mapbox-gl';
import { IconoComponent } from './icono.component';
import { obtenerTokenMapbox } from '../core/mapbox-config';

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

interface ContextoMapbox {
  address?: { address_number?: string; street_name?: string; name?: string };
  street?: { name?: string };
  neighborhood?: { name?: string };
  locality?: { name?: string };
  district?: { name?: string };
  place?: { name?: string };
  region?: { name?: string };
  country?: { name?: string };
}

interface ResultadoMapbox {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: {
    feature_type?: string;
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    context?: ContextoMapbox;
  };
}

const GEOCODIFICACION_MAPBOX = 'https://api.mapbox.com/search/geocode/v6';
const CENTRO_JALISCO: [number, number] = [-103.55, 20.6];
const CENTRO_BUSQUEDA: [number, number] = [-103.3918, 20.7211];
const ZOOM_JALISCO = 6.4;

function redondear(valor: number): number {
  return Number(valor.toFixed(6));
}

/** Expande abreviaturas mexicanas que suelen degradar la coincidencia de calles. */
function normalizarConsulta(consulta: string): string {
  return consulta
    .replace(/\bPte\.?(?=\s|,|$)/giu, 'Poniente')
    .replace(/\bOte\.?(?=\s|,|$)/giu, 'Oriente')
    .replace(/\bNte\.?(?=\s|,|$)/giu, 'Norte')
    .replace(/\bAv\.?(?=\s|,|$)/giu, 'Avenida')
    .replace(/\s+/g, ' ')
    .trim();
}

function etiquetaResultado(resultado: ResultadoMapbox): string {
  return (
    resultado.properties.full_address ??
    [
      resultado.properties.name_preferred ?? resultado.properties.name,
      resultado.properties.place_formatted,
    ]
      .filter(Boolean)
      .join(', ')
  );
}

function desarmarDireccion(resultado: ResultadoMapbox): DomicilioGeocodificado {
  const contexto = resultado.properties.context ?? {};
  const [longitud, latitud] = resultado.geometry.coordinates;
  const esCalle = resultado.properties.feature_type === 'street';

  return {
    calle:
      contexto.address?.street_name ??
      contexto.street?.name ??
      (esCalle ? (resultado.properties.name ?? '') : ''),
    numeroExterior: contexto.address?.address_number ?? '',
    colonia: contexto.neighborhood?.name ?? contexto.locality?.name ?? '',
    municipio: contexto.place?.name ?? contexto.district?.name ?? '',
    estado: contexto.region?.name ?? '',
    pais: contexto.country?.name ?? '',
    latitud: redondear(latitud),
    longitud: redondear(longitud),
  };
}

/**
 * Selector de domicilio sobre Mapbox GL: mapa vectorial nocturno, búsqueda
 * priorizada alrededor de Jalisco y geocodificación inversa al mover el pin.
 */
@Component({
  selector: 'rw-mapa-domicilio',
  standalone: true,
  imports: [FormsModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mapa-domicilio.component.html',
})
export class MapaDomicilioComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly contenedor = viewChild.required<ElementRef<HTMLDivElement>>('contenedor');
  private readonly token = obtenerTokenMapbox();

  /** Coordenadas iniciales del marcador (p. ej. un domicilio ya guardado). */
  readonly lat = input<number | null>(null);
  readonly lng = input<number | null>(null);
  /** En falso solo muestra el marcador, sin buscador ni clic (visor). */
  readonly interactivo = input(true);
  /** Texto con el que arranca el buscador (dirección ya guardada, en edición). */
  readonly consultaInicial = input('');
  readonly domicilio = output<DomicilioGeocodificado>();

  consulta = '';
  readonly buscando = signal(false);
  readonly resolviendoPunto = signal(false);
  readonly resultados = signal<ResultadoMapbox[]>([]);
  readonly errorBusqueda = signal<string | null>(null);
  readonly errorMapa = signal<string | null>(null);

  private mapa?: mapboxgl.Map;
  private marcador?: mapboxgl.Marker;
  private resizeObserver?: ResizeObserver;
  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;
  private abortadorBusqueda?: AbortController;
  private abortadorInverso?: AbortController;

  ngOnInit(): void {
    this.consulta = this.consultaInicial();
  }

  ngAfterViewInit(): void {
    if (!this.token) {
      this.errorMapa.set('No se configuró la clave pública de Mapbox para este entorno.');
      return;
    }

    const coordenadas = this.coordenadasIniciales();
    const conMarcador = coordenadas !== null;
    const inicial = coordenadas ?? CENTRO_JALISCO;

    this.mapa = new mapboxgl.Map({
      accessToken: this.token,
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
      center: inicial,
      zoom: conMarcador ? 16 : ZOOM_JALISCO,
      pitch: conMarcador ? 48 : 20,
      bearing: conMarcador ? -12 : 0,
      antialias: true,
      attributionControl: false,
    });

    this.mapa.addControl(
      new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'bottom-right',
    );
    this.mapa.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

    if (conMarcador) this.ponerMarcador(inicial);
    if (this.interactivo()) {
      this.mapa.on('click', (evento: MapMouseEvent) => {
        this.zone.run(() => void this.geocodificarInverso(evento.lngLat.lat, evento.lngLat.lng));
      });
    }

    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.mapa?.resize());
      this.resizeObserver.observe(this.contenedor().nativeElement);
    });
  }

  ngOnDestroy(): void {
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    this.abortadorBusqueda?.abort();
    this.abortadorInverso?.abort();
    this.resizeObserver?.disconnect();
    this.marcador?.remove();
    this.mapa?.remove();
  }

  alTeclear(): void {
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    this.errorBusqueda.set(null);
    if (this.consulta.trim().length < 3) {
      this.abortadorBusqueda?.abort();
      this.buscando.set(false);
      this.resultados.set([]);
      return;
    }
    this.temporizadorBusqueda = setTimeout(() => void this.buscar(), 350);
  }

  cerrarResultados(evento?: Event): void {
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    // Esc con resultados abiertos solo cierra la lista, no el modal contenedor.
    if (evento && this.resultados().length > 0) {
      evento.preventDefault();
      evento.stopPropagation();
    }
    this.resultados.set([]);
  }

  async buscar(): Promise<void> {
    const consulta = normalizarConsulta(this.consulta);
    if (!consulta || !this.token) return;

    this.abortadorBusqueda?.abort();
    const abortador = new AbortController();
    this.abortadorBusqueda = abortador;
    this.buscando.set(true);
    this.errorBusqueda.set(null);

    const parametros = new URLSearchParams({
      q: consulta,
      access_token: this.token,
      country: 'mx',
      language: 'es',
      limit: '6',
      proximity: CENTRO_BUSQUEDA.join(','),
      autocomplete: 'true',
    });

    try {
      const respuesta = await fetch(`${GEOCODIFICACION_MAPBOX}/forward?${parametros}`, {
        signal: abortador.signal,
      });
      if (!respuesta.ok) throw new Error(`Mapbox respondió ${respuesta.status}`);
      const cuerpo = (await respuesta.json()) as { features?: ResultadoMapbox[] };
      if (abortador.signal.aborted) return;

      const unicos = (cuerpo.features ?? []).filter(
        (resultado, indice, todos) =>
          todos.findIndex((otro) => etiquetaResultado(otro) === etiquetaResultado(resultado)) ===
          indice,
      );
      this.resultados.set(unicos);
      if (unicos.length === 0) {
        this.errorBusqueda.set(
          'Sin coincidencias. Pruebe con calle, número, colonia, municipio y estado.',
        );
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.errorBusqueda.set('No se pudo consultar Mapbox; intente nuevamente.');
      }
    } finally {
      if (this.abortadorBusqueda === abortador) this.buscando.set(false);
    }
  }

  elegir(resultado: ResultadoMapbox): void {
    this.abortadorBusqueda?.abort();
    this.cerrarResultados();
    this.buscando.set(false);
    this.consulta = etiquetaResultado(resultado);
    const domicilio = desarmarDireccion(resultado);
    this.irA(domicilio.latitud, domicilio.longitud);
    this.domicilio.emit(domicilio);
  }

  etiqueta(resultado: ResultadoMapbox): string {
    return etiquetaResultado(resultado);
  }

  tipoResultado(resultado: ResultadoMapbox): string {
    const tipos: Record<string, string> = {
      address: 'Dirección',
      street: 'Calle',
      neighborhood: 'Colonia',
      locality: 'Localidad',
      place: 'Municipio',
    };
    return tipos[resultado.properties.feature_type ?? ''] ?? 'Ubicación';
  }

  private async geocodificarInverso(latitud: number, longitud: number): Promise<void> {
    this.irA(latitud, longitud);
    this.abortadorInverso?.abort();
    const abortador = new AbortController();
    this.abortadorInverso = abortador;
    this.resolviendoPunto.set(true);

    const parametros = new URLSearchParams({
      longitude: String(longitud),
      latitude: String(latitud),
      access_token: this.token,
      country: 'mx',
      language: 'es',
    });

    try {
      const respuesta = await fetch(`${GEOCODIFICACION_MAPBOX}/reverse?${parametros}`, {
        signal: abortador.signal,
      });
      if (!respuesta.ok) throw new Error(`Mapbox respondió ${respuesta.status}`);
      const cuerpo = (await respuesta.json()) as { features?: ResultadoMapbox[] };
      if (abortador.signal.aborted) return;
      const resultado = cuerpo.features?.[0];
      if (resultado) {
        const domicilio = desarmarDireccion(resultado);
        this.consulta = etiquetaResultado(resultado);
        this.domicilio.emit({
          ...domicilio,
          latitud: redondear(latitud),
          longitud: redondear(longitud),
        });
        return;
      }
      this.emitirSoloCoordenadas(latitud, longitud);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.emitirSoloCoordenadas(latitud, longitud);
      }
    } finally {
      if (this.abortadorInverso === abortador) this.resolviendoPunto.set(false);
    }
  }

  private irA(latitud: number, longitud: number): void {
    const coordenadas: [number, number] = [longitud, latitud];
    this.ponerMarcador(coordenadas);
    this.mapa?.flyTo({
      center: coordenadas,
      zoom: Math.max(this.mapa.getZoom(), 16),
      pitch: 48,
      bearing: -12,
      speed: 1.25,
      essential: true,
    });
  }

  private ponerMarcador(coordenadas: [number, number]): void {
    if (!this.mapa) return;
    if (this.marcador) {
      this.marcador.setLngLat(coordenadas);
      return;
    }

    const elemento = document.createElement('button');
    elemento.type = 'button';
    elemento.className = 'mapbox-pin-futurista';
    elemento.setAttribute('aria-label', 'Ubicación seleccionada');
    elemento.append(document.createElement('span'));

    this.marcador = new mapboxgl.Marker({
      element: elemento,
      anchor: 'center',
      draggable: this.interactivo(),
    })
      .setLngLat(coordenadas)
      .addTo(this.mapa);

    if (this.interactivo()) {
      this.marcador.on('dragend', () => {
        const punto = this.marcador?.getLngLat();
        if (punto) {
          this.zone.run(() => void this.geocodificarInverso(punto.lat, punto.lng));
        }
      });
    }
  }

  private coordenadasIniciales(): [number, number] | null {
    const latitud = Number(this.lat());
    const longitud = Number(this.lng());
    return Number.isFinite(latitud) && Number.isFinite(longitud) && latitud !== 0 && longitud !== 0
      ? [longitud, latitud]
      : null;
  }

  private emitirSoloCoordenadas(latitud: number, longitud: number): void {
    this.domicilio.emit({
      calle: '',
      numeroExterior: '',
      colonia: '',
      municipio: '',
      estado: '',
      pais: '',
      latitud: redondear(latitud),
      longitud: redondear(longitud),
    });
  }
}
