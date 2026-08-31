import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Paginado, ValorCatalogo } from './models';

/**
 * Catálogos del dominio (RF-CAT-*): identificados por slug en la ruta;
 * cada tabla tiene su PK propia (idDelito, idCentro...) que aquí se
 * normaliza a `id` para la UI. Solo UUIDs viajan al backend (RF-GEN-002).
 */
export const PK_POR_CATALOGO: Record<string, string> = {
  // administrables (§16.1)
  delitos: 'idDelito',
  centros: 'idCentro',
  juzgados: 'idJuzgado',
  juez_juzgados: 'idJuezJuzgado',
  destino_traslado: 'idDestinoTraslado',
  tipo_audiencia: 'idTipoAudiencia',
  tipo_incidencia: 'idTipoIncidencia',
  autoridad: 'idAutoridad',
  // fijos (RF-CAT-008/009)
  tipo_ingreso_egreso: 'idTipoIngresoEgreso',
  tipo_movimientos: 'idTipoMovimiento',
  motivo_movimiento: 'idMotivoMovimiento',
  forma_ingreso_audiencia: 'idFormaIngresoAudiencia',
  resolucion_audiencia: 'idResolucionAudiencia',
  modalidad_audiencia: 'idModalidadAudiencia',
  proxima_audiencia: 'idProximaAudiencia',
  tipo_traslado: 'idTipoTraslado',
  estatus_traslado: 'idEstatusTraslado',
};

export const CATALOGOS_ADMINISTRABLES: { slug: string; etiqueta: string }[] = [
  { slug: 'delitos', etiqueta: 'Delitos' },
  { slug: 'centros', etiqueta: 'Centros penitenciarios' },
  { slug: 'juzgados', etiqueta: 'Juzgados' },
  { slug: 'juez_juzgados', etiqueta: 'Jueces por juzgado' },
  { slug: 'destino_traslado', etiqueta: 'Destinos de traslado' },
  { slug: 'tipo_audiencia', etiqueta: 'Tipos de audiencia' },
  { slug: 'tipo_incidencia', etiqueta: 'Tipos de incidencia' },
  { slug: 'autoridad', etiqueta: 'Autoridades' },
];

export const CATALOGOS_FIJOS: { slug: string; etiqueta: string }[] = [
  { slug: 'tipo_ingreso_egreso', etiqueta: 'Tipos de ingreso/egreso' },
  { slug: 'tipo_movimientos', etiqueta: 'Tipos de movimiento' },
  { slug: 'motivo_movimiento', etiqueta: 'Motivos de movimiento' },
  { slug: 'forma_ingreso_audiencia', etiqueta: 'Formas de ingreso a audiencia' },
  { slug: 'resolucion_audiencia', etiqueta: 'Resoluciones de audiencia' },
  { slug: 'modalidad_audiencia', etiqueta: 'Modalidades de audiencia' },
  { slug: 'proxima_audiencia', etiqueta: 'Próxima audiencia' },
  { slug: 'tipo_traslado', etiqueta: 'Tipos de traslado' },
  { slug: 'estatus_traslado', etiqueta: 'Estatus de traslado' },
];

const SLUGS_FIJOS = new Set(CATALOGOS_FIJOS.map((c) => c.slug));

/** Orden natural "menor a mayor": JUEZ 2 antes que JUEZ 10 (los fijos conservan su campo `orden`). */
const COMPARADOR_NATURAL = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, Promise<ValorCatalogo[]>>();

  /** Valores ACTIVOS de un catálogo (con caché por sesión de página). */
  valores(slug: string): Promise<ValorCatalogo[]> {
    let pendiente = this.cache.get(slug);
    if (!pendiente) {
      const url = SLUGS_FIJOS.has(slug)
        ? `/api/v1/catalogos/fijos/${slug}`
        : `/api/v1/catalogos/${slug}`;
      pendiente = this.api
        .get<Record<string, unknown>[]>(url)
        .then((filas) => {
          const valores = filas.map((f) => normalizar(slug, f));
          if (!SLUGS_FIJOS.has(slug)) {
            valores.sort((a, b) => COMPARADOR_NATURAL.compare(a.nombre, b.nombre));
          }
          return valores;
        })
        .catch((err) => {
          this.cache.delete(slug);
          throw err;
        });
      this.cache.set(slug, pendiente);
    }
    return pendiente;
  }

  /** Mapa id → nombre para pintar UUIDs de catálogo en listados. */
  async mapa(slug: string): Promise<Map<string, string>> {
    const valores = await this.valores(slug);
    return new Map(valores.map((v) => [v.id, v.nombre]));
  }

  /** Listado de administración: incluye inactivos, sin caché (RF-CAT-001). */
  listarAdministrable(slug: string, incluirInactivos: boolean): Promise<ValorCatalogo[]> {
    return this.api
      .get<Record<string, unknown>[]>(`/api/v1/catalogos/${slug}`, {
        incluirInactivos: incluirInactivos || undefined,
      })
      .then((filas) => filas.map((f) => normalizar(slug, f)));
  }

  /** Listado de administración paginado desde el backend (pantalla de catálogos). */
  listarAdministrablePaginado(
    slug: string,
    incluirInactivos: boolean,
    page: number,
    limit: number,
    buscar?: string,
  ): Promise<Paginado<ValorCatalogo>> {
    return this.api
      .get<Paginado<Record<string, unknown>>>(`/api/v1/catalogos/${slug}`, {
        incluirInactivos: incluirInactivos || undefined,
        page,
        limit,
        buscar: buscar || undefined,
      })
      .then((pagina) => ({ ...pagina, items: pagina.items.map((f) => normalizar(slug, f)) }));
  }

  crear(
    slug: string,
    dto: { nombre: string; descripcion?: string; latitud?: number; longitud?: number },
  ): Promise<ValorCatalogo> {
    this.invalidar(slug);
    return this.api
      .post<Record<string, unknown>>(`/api/v1/catalogos/${slug}`, dto)
      .then((f) => normalizar(slug, f));
  }

  corregir(
    slug: string,
    id: string,
    dto: { nombre?: string; descripcion?: string; latitud?: number; longitud?: number },
  ): Promise<ValorCatalogo> {
    this.invalidar(slug);
    return this.api
      .patch<Record<string, unknown>>(`/api/v1/catalogos/${slug}/${id}`, dto)
      .then((f) => normalizar(slug, f));
  }

  desactivar(slug: string, id: string): Promise<void> {
    this.invalidar(slug);
    return this.api.post(`/api/v1/catalogos/${slug}/${id}/desactivar`, {}).then(() => undefined);
  }

  reactivar(slug: string, id: string): Promise<void> {
    this.invalidar(slug);
    return this.api.post(`/api/v1/catalogos/${slug}/${id}/reactivar`, {}).then(() => undefined);
  }

  esFijo(slug: string): boolean {
    return SLUGS_FIJOS.has(slug);
  }

  private invalidar(slug: string): void {
    this.cache.delete(slug);
  }
}

function normalizar(slug: string, fila: Record<string, unknown>): ValorCatalogo {
  const pk = PK_POR_CATALOGO[slug];
  return {
    id: String(fila[pk] ?? ''),
    nombre: String(fila['nombre'] ?? ''),
    descripcion: (fila['descripcion'] as string | undefined) ?? undefined,
    activo: (fila['activo'] as boolean | undefined) ?? true,
    latitud: (fila['latitud'] as number | null | undefined) ?? null,
    longitud: (fila['longitud'] as number | null | undefined) ?? null,
  };
}
