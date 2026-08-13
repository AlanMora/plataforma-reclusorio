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
import { Paginado, ValorCatalogo } from '../../core/models';
import { mensajeDe } from '../../core/problem';
import { AsistenteMapaComponent } from './asistente-mapa.component';
import {
  ComandoAsistente,
  PeriodoConsulta,
  normalizar,
  resolverCentro,
} from './asistente-intents';

const CENTRO_JALISCO: L.LatLngTuple = [20.6, -103.35];

/** Fila del resumen de incidencias por centro (endpoint P11). */
interface ResumenIncidencias {
  idCentroPenitenciario: string;
  total: number;
  ultimaFecha: string;
}

/** Incidencia con el detalle que se muestra y se narra en el mapa. */
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

/** Traslado con persona y centro de origen (endpoint traslados/mapa, P11). */
interface TrasladoMapa {
  idTraslado: string;
  fecha: string;
  idPersona: string;
  nombrePersona: string;
  alias?: string;
  idTipoTraslado: string;
  idDestinoTraslado: string;
  idEstatusTraslado: string;
  unidades?: string;
  descripcion?: string;
  observaciones?: string;
  estadoRevision: string;
  idCentroOrigen?: string;
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
 * Módulo Penitenciarios: mapa general (Leaflet en blanco y negro) con un
 * punto por cada centro penitenciario del catálogo, el estado de Jalisco
 * resaltado con su límite oficial (OSM), la POBLACIÓN actual de cada centro
 * sobre el pin (última entrada tipo INGRESO de cada persona) y una ficha
 * con el detalle de las personas del centro seleccionado.
 */
@Component({
  selector: 'rw-penitenciarios',
  standalone: true,
  imports: [DatePipe, RouterLink, AsistenteMapaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './penitenciarios.component.html',
})
export class PenitenciariosComponent implements AfterViewInit, OnDestroy {
  private readonly catalogos = inject(CatalogosService);
  private readonly api = inject(ApiService);

  @ViewChild('contenedor') private readonly contenedor!: ElementRef<HTMLDivElement>;
  @ViewChild(AsistenteMapaComponent) private readonly asistente?: AsistenteMapaComponent;

  readonly centros = signal<ValorCatalogo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly seleccionado = signal<string | null>(null);
  /** Panel flotante de centros dentro del mapa; inicia contraído para ver el mapa completo. */
  readonly panelAbierto = signal(false);
  /** Población por centro; null si el usuario no puede consultar personas. */
  readonly poblacion = signal<Map<string, PersonaEnCentro[]> | null>(null);
  /** Capa de incidencias activada por el asistente; null = pines de población. */
  readonly capaIncidencias = signal<Map<string, number> | null>(null);
  /** Etiqueta del periodo de la capa activa, para el letrero del mapa. */
  readonly etiquetaCapa = signal('');
  /** Pestaña activa de la ficha del centro. */
  readonly fichaTab = signal<'poblacion' | 'incidencias'>('poblacion');
  /** Incidencias del centro seleccionado; null mientras carga o sin permiso. */
  readonly incidenciasCentro = signal<IncidenciaMapa[] | null>(null);
  /** Capa de traslados dibujada por el asistente (líneas origen → destino). */
  readonly capaTraslados = signal<TrasladoMapa[] | null>(null);
  readonly etiquetaTraslados = signal('');
  readonly trasladoSeleccionado = signal<string | null>(null);

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
  private readonly lineasTraslados = new Map<string, L.Polyline>();
  /** Nombres de catálogo para narrar y mostrar (id → nombre). */
  private mapaTiposIncidencia = new Map<string, string>();
  private mapaDestinos = new Map<string, string>();
  private mapaTiposTraslado = new Map<string, string>();
  private mapaEstatusTraslado = new Map<string, string>();

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

  /** Centra el mapa en un centro y abre su ficha flotante. */
  enfocar(centro: ValorCatalogo): void {
    if (centro.latitud == null || centro.longitud == null || !this.mapa) return;
    this.seleccionar(centro.id);
    this.mapa.flyTo([centro.latitud, centro.longitud], 15, { duration: 0.8 });
  }

  /** Selecciona un centro y carga sus incidencias para la ficha. */
  seleccionar(id: string): void {
    this.seleccionado.set(id);
    // Con la capa de incidencias activa la ficha abre en esa pestaña.
    this.fichaTab.set(this.capaIncidencias() ? 'incidencias' : 'poblacion');
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
  nombreDestino(id: string): string {
    return this.mapaDestinos.get(id) ?? '…';
  }
  nombreTipoTraslado(id: string): string {
    return this.mapaTiposTraslado.get(id) ?? '…';
  }
  nombreEstatusTraslado(id: string): string {
    return this.mapaEstatusTraslado.get(id) ?? '…';
  }
  nombreCentro(id: string | undefined): string {
    return this.centros().find((c) => c.id === id)?.nombre ?? 'centro no identificado';
  }

  verTodos(): void {
    this.seleccionado.set(null);
    this.ajustarVista();
  }

  /**
   * Ejecuta el comando interpretado por el asistente de voz (P11) y le
   * regresa la respuesta que se muestra y se lee en voz alta. Los datos
   * salen SIEMPRE de los endpoints normales con los permisos del JWT.
   */
  async ejecutarComando(cmd: ComandoAsistente): Promise<void> {
    switch (cmd.tipo) {
      case 'ir_a_centro': {
        const centro = resolverCentro(cmd.consulta, this.centros());
        if (!centro) {
          // No es un centro: puede ser el nombre de una persona (F2 del asistente).
          await this.buscarPersona(cmd.consulta);
          return;
        }
        if (centro.latitud == null || centro.longitud == null) {
          this.responder(`${centro.nombre} existe, pero aún no tiene ubicación registrada.`);
          return;
        }
        this.enfocar(centro);
        const personas = this.poblacion() ? this.conteo(centro.id) : null;
        this.responder(
          `Enfocando ${centro.nombre}.` +
            (personas !== null ? ` Población actual: ${personas} persona(s).` : ''),
        );
        return;
      }
      case 'poblacion': {
        if (this.poblacion() === null) {
          this.responder('No tienes permiso para consultar la población (personas:consultar).');
          return;
        }
        const centro = cmd.consulta ? resolverCentro(cmd.consulta, this.centros()) : null;
        if (centro) {
          const gente = this.poblacion()?.get(centro.id) ?? [];
          if (centro.latitud != null && centro.longitud != null) this.enfocar(centro);
          const muestra = gente
            .slice(0, 3)
            .map((p) => p.nombre + (p.delito ? ` (${p.delito})` : ''))
            .join('; ');
          this.responder(
            `${centro.nombre} tiene ${gente.length} persona(s) actualmente.` +
              (muestra
                ? ` Entre ellas: ${muestra}${gente.length > 3 ? ', entre otras' : ''}.` +
                  ' El detalle completo está en la ficha del centro.'
                : ''),
          );
          return;
        }
        const mayor = this.centroConMasPoblacion();
        this.responder(
          `Hay ${this.totalPoblacion()} persona(s) en ${this.centros().length} centros.` +
            (mayor ? ` El de mayor población es ${mayor.nombre} con ${mayor.total}.` : '') +
            ' Puedes preguntarme por un centro o por una persona en específico.',
        );
        return;
      }
      case 'incidencias': {
        const resumen = await this.resumenIncidencias(cmd.periodo);
        if (resumen === null) return;
        const centro = cmd.consulta ? resolverCentro(cmd.consulta, this.centros()) : null;
        if (centro) {
          const total = resumen.get(centro.id) ?? 0;
          if (centro.latitud != null && centro.longitud != null) this.enfocar(centro);
          this.fichaTab.set('incidencias');
          this.responder(
            `${centro.nombre} registra ${total} incidencia(s) ${cmd.periodo.etiqueta}.` +
              (total > 0 ? ` ${await this.narrarIncidencias(centro.id, cmd.periodo)}` : ''),
          );
          return;
        }
        this.capaIncidencias.set(resumen);
        this.etiquetaCapa.set(cmd.periodo.etiqueta);
        this.pintarMarcadores();
        const total = [...resumen.values()].reduce((s, n) => s + n, 0);
        this.responder(
          `Se registran ${total} incidencia(s) ${cmd.periodo.etiqueta}. ${this.narrarTop(resumen)}` +
            ' Los pines muestran incidencias; toca un centro para leer el detalle y la narrativa,' +
            ' o di "ver todos" para volver a población.',
        );
        return;
      }
      case 'traslados': {
        const lista = await this.trasladosMapa(cmd.periodo, cmd.consulta);
        if (lista === null) return;
        if (lista.length === 0) {
          this.responder(`No hay traslados ${cmd.periodo.etiqueta}.`);
          return;
        }
        this.capaTraslados.set(lista);
        this.etiquetaTraslados.set(cmd.periodo.etiqueta);
        this.trasladoSeleccionado.set(null);
        this.seleccionado.set(null);
        const trazados = this.dibujarTraslados();
        const primero = lista[0];
        this.responder(
          `${lista.length} traslado(s) ${cmd.periodo.etiqueta}, ${trazados} trazado(s) en el mapa` +
            ' de origen a destino. El más reciente: ' +
            `${primero.nombrePersona} hacia ${this.nombreDestino(primero.idDestinoTraslado)},` +
            ` estatus ${this.nombreEstatusTraslado(primero.idEstatusTraslado)}.` +
            ' Toca una línea o un traslado de la lista para el detalle completo.',
        );
        return;
      }
      case 'resumen': {
        const partes: string[] = [];
        if (this.poblacion() !== null) {
          const mayor = this.centroConMasPoblacion();
          partes.push(
            `Población: ${this.totalPoblacion()} persona(s) en ${this.centros().length} centros` +
              (mayor ? `, encabezados por ${mayor.nombre} con ${mayor.total}` : '') +
              '.',
          );
        }
        const resumen = await this.resumenIncidencias(cmd.periodo, true);
        if (resumen) {
          const total = [...resumen.values()].reduce((s, n) => s + n, 0);
          partes.push(`Incidencias ${cmd.periodo.etiqueta}: ${total}. ${this.narrarTop(resumen)}`);
        }
        if (this.sinUbicacion().length > 0) {
          partes.push(`${this.sinUbicacion().length} centro(s) siguen sin ubicación registrada.`);
        }
        this.responder(partes.join(' ') || 'No tengo datos disponibles con tus permisos actuales.');
        return;
      }
      case 'ver_todos':
        this.capaIncidencias.set(null);
        this.etiquetaCapa.set('');
        this.limpiarTraslados();
        this.pintarMarcadores();
        this.verTodos();
        this.responder('Listo, vista general con población por centro.');
        return;
      case 'ayuda':
        this.responder(
          'Puedo enfocar un centro ("llévame a Puente Grande"), buscar a una persona por nombre, ' +
            'decirte la población ("¿cuántas personas hay en…?"), narrar incidencias con su ' +
            'descripción ("incidencias de este mes en Puente Grande"), dibujar traslados de origen ' +
            'a destino ("traslados de la semana"), darte un resumen, o limpiar con "ver todos".',
        );
        return;
      default:
        this.responder('No entendí la instrucción. Di "ayuda" para conocer los comandos.');
    }
  }

  private responder(texto: string): void {
    this.asistente?.responder(texto);
  }

  private centroConMasPoblacion(): { nombre: string; total: number } | null {
    let mejor: { nombre: string; total: number } | null = null;
    for (const centro of this.centros()) {
      const total = this.conteo(centro.id);
      if (total > (mejor?.total ?? 0)) mejor = { nombre: centro.nombre, total };
    }
    return mejor;
  }

  /** Los tres centros con más incidencias, en una frase narrable. */
  private narrarTop(resumen: Map<string, number>): string {
    const nombres = new Map(this.centros().map((c) => [c.id, c.nombre]));
    const top = [...resumen.entries()]
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, total]) => `${nombres.get(id) ?? 'centro desconocido'} (${total})`);
    return top.length > 0 ? `Los más altos: ${top.join(', ')}.` : 'Ningún centro registra casos.';
  }

  /** Narra las incidencias más recientes del centro: tipo, fecha, descripción y narrativa. */
  private async narrarIncidencias(idCentro: string, periodo: PeriodoConsulta): Promise<string> {
    try {
      const pagina = await this.api.get<Paginado<IncidenciaMapa>>('/api/v1/incidencias', {
        page: 1,
        limit: 2,
        idCentroPenitenciario: idCentro,
        desde: periodo.desde ?? undefined,
        hasta: periodo.hasta ?? undefined,
      });
      return pagina.items
        .map((i) => {
          const fecha = new Date(i.fecha).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
          });
          const narrativa = i.narrativa ? ` Narrativa: ${this.recortar(i.narrativa, 220)}` : '';
          return `${this.nombreTipoIncidencia(i.idTipoIncidencia)} del ${fecha}: ${this.recortar(i.descripcion, 200)}.${narrativa}`;
        })
        .join(' También: ');
    } catch {
      return '';
    }
  }

  private recortar(texto: string, largo: number): string {
    const limpio = texto.trim();
    return limpio.length > largo ? `${limpio.slice(0, largo)}…` : limpio;
  }

  /** Busca a una persona por nombre en la población actual y la ubica en su centro. */
  private async buscarPersona(consulta: string): Promise<void> {
    const poblacion = this.poblacion();
    if (poblacion) {
      const objetivo = normalizar(consulta);
      for (const [idCentro, gente] of poblacion) {
        const persona = gente.find((p) =>
          objetivo
            .split(' ')
            .filter((t) => t.length >= 3)
            .every((t) => normalizar(`${p.nombre} ${p.alias ?? ''}`).includes(t)),
        );
        if (persona) {
          const centro = this.centros().find((c) => c.id === idCentro);
          if (centro && centro.latitud != null && centro.longitud != null) this.enfocar(centro);
          else this.seleccionar(idCentro);
          const ingreso = new Date(persona.fechaIngreso).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
          this.responder(
            `${persona.nombre}${persona.alias ? `, alias ${persona.alias}` : ''}` +
              `${persona.edad !== null ? `, ${persona.edad} años` : ''}, está en ` +
              `${centro?.nombre ?? 'un centro sin ubicación'} desde el ${ingreso}` +
              `${persona.delito ? `, por ${persona.delito}` : ''}. Su expediente está en la ficha del centro.`,
          );
          return;
        }
      }
    }
    // No está en la población actual: verificar si al menos existe en el padrón.
    try {
      const pagina = await this.api.get<Paginado<{ idPersona: string }>>('/api/v1/personas', {
        page: 1,
        limit: 1,
        buscar: consulta,
      });
      if (pagina.total > 0) {
        this.responder(
          `Encontré a "${consulta}" en el padrón, pero no está actualmente en ningún centro ` +
            '(su último movimiento no es un ingreso).',
        );
        return;
      }
    } catch {
      // sin permiso de personas: cae al mensaje genérico
    }
    this.responder(`No encontré ningún centro ni persona que coincida con "${consulta}".`);
  }

  /** Traslados del periodo (endpoint P11); filtra por persona si se dijo un nombre. */
  private async trasladosMapa(
    periodo: PeriodoConsulta,
    consulta: string,
  ): Promise<TrasladoMapa[] | null> {
    try {
      let lista = await this.api.get<TrasladoMapa[]>('/api/v1/traslados/mapa', {
        desde: periodo.desde ?? undefined,
        hasta: periodo.hasta ?? undefined,
      });
      if (consulta) {
        const tokens = normalizar(consulta)
          .split(' ')
          .filter((t) => t.length >= 3);
        const filtrada = lista.filter((t) =>
          tokens.every((tok) => normalizar(`${t.nombrePersona} ${t.alias ?? ''}`).includes(tok)),
        );
        if (filtrada.length > 0) lista = filtrada;
      }
      return lista;
    } catch (err) {
      this.responder(`No pude consultar traslados: ${mensajeDe(err)}`);
      return null;
    }
  }

  /** Dibuja las líneas origen → destino; devuelve cuántas se pudieron trazar. */
  private dibujarTraslados(): number {
    this.limpiarLineas();
    const lista = this.capaTraslados();
    if (!lista || !this.mapa) return 0;
    const centrosPorId = new Map(this.centros().map((c) => [c.id, c]));
    const puntos: L.LatLngTuple[] = [];
    for (const t of lista) {
      const origen = t.idCentroOrigen ? centrosPorId.get(t.idCentroOrigen) : undefined;
      // El destino es texto de catálogo; si corresponde a un centro con
      // coordenadas (traslado inter-centros), la línea se puede trazar.
      const destino = resolverCentro(this.nombreDestino(t.idDestinoTraslado), this.conUbicacion());
      if (
        origen?.latitud == null ||
        origen?.longitud == null ||
        destino?.latitud == null ||
        destino?.longitud == null
      ) {
        continue;
      }
      const extremos: L.LatLngTuple[] = [
        [origen.latitud, origen.longitud],
        [destino.latitud, destino.longitud],
      ];
      puntos.push(...extremos);
      const linea = L.polyline(extremos, {
        color: '#818cf8',
        weight: 3,
        opacity: 0.75,
        dashArray: '6 8',
      }).addTo(this.mapa);
      linea.on('click', () => this.seleccionarTraslado(t.idTraslado));
      this.lineasTraslados.set(t.idTraslado, linea);
    }
    if (puntos.length > 0) this.mapa.fitBounds(L.latLngBounds(puntos).pad(0.2));
    return this.lineasTraslados.size;
  }

  /** Resalta un traslado, encuadra su línea y narra el detalle completo. */
  seleccionarTraslado(idTraslado: string): void {
    const traslado = this.capaTraslados()?.find((t) => t.idTraslado === idTraslado);
    if (!traslado) return;
    this.trasladoSeleccionado.set(idTraslado);
    for (const [id, linea] of this.lineasTraslados) {
      linea.setStyle(
        id === idTraslado
          ? { color: '#22d3ee', weight: 5, opacity: 1, dashArray: undefined }
          : { color: '#818cf8', weight: 2, opacity: 0.3, dashArray: '6 8' },
      );
    }
    const linea = this.lineasTraslados.get(idTraslado);
    if (linea && this.mapa) this.mapa.flyToBounds(linea.getBounds().pad(0.35), { duration: 0.8 });
    const fecha = new Date(traslado.fecha).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    this.responder(
      `Traslado de ${traslado.nombrePersona}` +
        `${traslado.alias ? `, alias ${traslado.alias}` : ''}, el ${fecha}: ` +
        `${this.nombreTipoTraslado(traslado.idTipoTraslado)} desde ` +
        `${this.nombreCentro(traslado.idCentroOrigen)} hacia ` +
        `${this.nombreDestino(traslado.idDestinoTraslado)}, estatus ` +
        `${this.nombreEstatusTraslado(traslado.idEstatusTraslado)}` +
        `${traslado.unidades ? `, unidades ${traslado.unidades}` : ''}.` +
        `${traslado.descripcion ? ` ${this.recortar(traslado.descripcion, 180)}.` : ''}` +
        `${traslado.observaciones ? ` Observaciones: ${this.recortar(traslado.observaciones, 160)}` : ''}`,
    );
  }

  /** Quita la capa de traslados (botón de la ficha y "ver todos"). */
  limpiarTraslados(): void {
    this.capaTraslados.set(null);
    this.etiquetaTraslados.set('');
    this.trasladoSeleccionado.set(null);
    this.limpiarLineas();
  }

  private limpiarLineas(): void {
    for (const linea of this.lineasTraslados.values()) linea.remove();
    this.lineasTraslados.clear();
  }

  /**
   * Conteo de incidencias por centro (endpoint P11). Devuelve null y responde
   * al usuario si falta el permiso; con `silencioso` solo devuelve null.
   */
  private async resumenIncidencias(
    periodo: PeriodoConsulta,
    silencioso = false,
  ): Promise<Map<string, number> | null> {
    try {
      const filas = await this.api.get<ResumenIncidencias[]>(
        '/api/v1/incidencias/resumen-por-centro',
        { desde: periodo.desde ?? undefined, hasta: periodo.hasta ?? undefined },
      );
      return new Map(filas.map((f) => [f.idCentroPenitenciario, f.total]));
    } catch (err) {
      if (!silencioso) this.responder(`No pude consultar incidencias: ${mensajeDe(err)}`);
      return null;
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [centros] = await Promise.all([
        this.catalogos.listarAdministrable('centros', false),
        this.cargarPoblacion(),
        this.cargarCatalogosNarracion(),
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

  /** Nombres de catálogo usados al narrar; si fallan, la narración degrada a "…". */
  private async cargarCatalogosNarracion(): Promise<void> {
    try {
      const [tiposIncidencia, destinos, tiposTraslado, estatusTraslado] = await Promise.all([
        this.catalogos.mapa('tipo_incidencia'),
        this.catalogos.mapa('destino_traslado'),
        this.catalogos.mapa('tipo_traslado'),
        this.catalogos.mapa('estatus_traslado'),
      ]);
      this.mapaTiposIncidencia = tiposIncidencia;
      this.mapaDestinos = destinos;
      this.mapaTiposTraslado = tiposTraslado;
      this.mapaEstatusTraslado = estatusTraslado;
    } catch {
      // Sin catálogos la capa sigue funcionando con identificadores.
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
    for (const marcador of this.marcadores.values()) marcador.remove();
    this.marcadores.clear();
    const incidencias = this.capaIncidencias();
    for (const centro of this.conUbicacion()) {
      // Con la capa de incidencias activa el pin cuenta incidencias (rojo);
      // si no, cuenta población; sin datos, punto simple.
      const conteo = incidencias ? (incidencias.get(centro.id) ?? 0) : this.conteo(centro.id);
      const icono =
        conteo > 0
          ? L.divIcon({
              className: '',
              html: `<span class="pin-conteo${incidencias ? ' pin-conteo--incidencias' : ''}">${conteo}</span>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            })
          : L.divIcon({
              className: '',
              html: '<span class="pin-bn"></span>',
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            });
      // Sin popup: el clic abre la ficha flotante (detalle completo del centro).
      const marcador = L.marker([centro.latitud!, centro.longitud!], {
        icon: icono,
        title: centro.nombre,
      }).addTo(this.mapa);
      marcador.on('click', () => this.seleccionar(centro.id));
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
