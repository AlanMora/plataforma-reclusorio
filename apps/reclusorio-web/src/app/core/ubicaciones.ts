/**
 * Catálogo de ubicaciones (país → estado → municipio).
 *
 * Los valores NO viven en este archivo: se cargan una sola vez al arrancar la
 * aplicación desde `public/catalogos/ubicaciones.json` (~200 KB), generado por
 * `tools/catalogos/generar-catalogos.py` a partir de fuentes oficiales:
 *
 * - México: servicio de catálogos geoestadísticos del INEGI
 *   (gaia.inegi.org.mx/wscatgeo) — 32 entidades federativas y sus 2 478
 *   municipios y demarcaciones territoriales.
 * - Resto del mundo: Wikidata (ISO 3166-1 y divisiones de primer nivel) —
 *   196 países con sus estados/provincias/departamentos. SIN municipios: no
 *   existe una fuente homogénea para todos, por eso los selects de estado y
 *   municipio admiten captura manual (`permitirLibre`).
 *
 * Cuando el equipo apruebe los catálogos de ubicación en el backend (P9 del
 * PLAN) basta con que `cargarUbicaciones()` consulte al gateway: ni el resto
 * de este archivo ni los componentes cambian.
 */

export interface EstadoUbicacion {
  nombre: string;
  municipios: string[];
}

export interface PaisUbicacion {
  nombre: string;
  estados: EstadoUbicacion[];
}

/** Asset estático servido por Angular desde `public/` (base href `/`). */
const RUTA_CATALOGO = '/catalogos/ubicaciones.json';

let catalogoPaises: PaisUbicacion[] = [];

/**
 * Carga el catálogo una sola vez al arrancar la aplicación. Si el asset no
 * responde la aplicación sigue operando con los selects vacíos y captura
 * manual: la captura de un domicilio nunca queda bloqueada por el catálogo.
 */
export async function cargarUbicaciones(): Promise<void> {
  if (catalogoPaises.length > 0) return;
  try {
    const respuesta = await fetch(RUTA_CATALOGO);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const datos = (await respuesta.json()) as { paises?: PaisUbicacion[] };
    catalogoPaises = datos.paises ?? [];
  } catch (error) {
    console.error('No se pudo cargar el catálogo de ubicaciones', error);
    catalogoPaises = [];
  }
}

/** Países del catálogo, en el orden del archivo (México primero). */
export function paises(): PaisUbicacion[] {
  return catalogoPaises;
}

/** Nombres de los países, para los selects. */
export function nombresPaises(): string[] {
  return catalogoPaises.map((p) => p.nombre);
}

/** Entidades federativas de México, para el estado de nacimiento. */
export function estadosDeMexico(): string[] {
  return estadosDe('México').map((e) => e.nombre);
}

/** Normaliza para comparar: sin acentos, minúsculas, espacios colapsados. */
export function normalizarUbicacion(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function estadosDe(pais: string): EstadoUbicacion[] {
  const p = catalogoPaises.find(
    (x) => normalizarUbicacion(x.nombre) === normalizarUbicacion(pais ?? ''),
  );
  return p?.estados ?? [];
}

export function municipiosDe(pais: string, estado: string): string[] {
  const e = estadosDe(pais).find(
    (x) => normalizarUbicacion(x.nombre) === normalizarUbicacion(estado ?? ''),
  );
  return e?.municipios ?? [];
}

/**
 * Clave estricta de comparación: además de `normalizarUbicacion`, elimina
 * puntuación y artículos sueltos que suelen colarse desde geocodificadores o
 * capturas manuales ("Jal.", "Estado de Jalisco,").
 */
function claveUbicacion(valor: string): string {
  return normalizarUbicacion(valor)
    .replace(/[.,;:()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prefijos que NO forman parte del nombre oficial y que geocodificadores o
 * capturas previas anteponen: "Estado de Jalisco", "Edo. de Jalisco",
 * "Municipio de Zapopan", "Estado Libre y Soberano de Jalisco"…
 */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ¿`clave` contiene `fragmento` como palabra(s) completa(s)? */
function contienePalabra(clave: string, fragmento: string): boolean {
  return new RegExp(`(?:^| )${escaparRegex(fragmento)}(?: |$)`, 'u').test(clave);
}

const PREFIJOS_UBICACION =
  /^(?:estado libre y soberano de|estado de|edo de|edo|est de|estado|provincia de|departamento de|depto de|municipio de|mpio de|municipalidad de|delegacion|alcaldia)\s+/u;

/**
 * Sinónimos, abreviaturas oficiales y nombres largos (constitucionales) que
 * deben resolverse al nombre canónico del catálogo. Las claves están en la
 * forma de `claveUbicacion`. Solo se aplican cuando el destino existe en el
 * catálogo consultado, por lo que "mexico" resuelve a "Estado de México" al
 * buscar entre estados pero a "México" al buscar entre países.
 */
const ALIAS_UBICACION: Record<string, string> = {
  // Países
  'estados unidos mexicanos': 'México',
  'republica mexicana': 'México',
  mx: 'México',
  mex: 'México',
  usa: 'Estados Unidos',
  us: 'Estados Unidos',
  eua: 'Estados Unidos',
  eeuu: 'Estados Unidos',
  'ee uu': 'Estados Unidos',
  'united states': 'Estados Unidos',
  'united states of america': 'Estados Unidos',
  'estados unidos de america': 'Estados Unidos',
  // Estados de México (nombres largos, abreviaturas, sinónimos)
  ags: 'Aguascalientes',
  bc: 'Baja California',
  bcn: 'Baja California',
  'baja california norte': 'Baja California',
  bcs: 'Baja California Sur',
  camp: 'Campeche',
  chis: 'Chiapas',
  chih: 'Chihuahua',
  cdmx: 'Ciudad de México',
  df: 'Ciudad de México',
  'd f': 'Ciudad de México',
  'distrito federal': 'Ciudad de México',
  'mexico city': 'Ciudad de México',
  'mexico d f': 'Ciudad de México',
  coah: 'Coahuila',
  'coahuila de zaragoza': 'Coahuila',
  col: 'Colima',
  dgo: 'Durango',
  gto: 'Guanajuato',
  gro: 'Guerrero',
  hgo: 'Hidalgo',
  jal: 'Jalisco',
  mexico: 'Estado de México',
  edomex: 'Estado de México',
  'edo mex': 'Estado de México',
  'edo mexico': 'Estado de México',
  'mexico estado': 'Estado de México',
  mich: 'Michoacán',
  'michoacan de ocampo': 'Michoacán',
  mor: 'Morelos',
  nay: 'Nayarit',
  nl: 'Nuevo León',
  'n l': 'Nuevo León',
  oax: 'Oaxaca',
  pue: 'Puebla',
  qro: 'Querétaro',
  'queretaro de arteaga': 'Querétaro',
  'q roo': 'Quintana Roo',
  qroo: 'Quintana Roo',
  slp: 'San Luis Potosí',
  sin: 'Sinaloa',
  son: 'Sonora',
  tab: 'Tabasco',
  tamps: 'Tamaulipas',
  tam: 'Tamaulipas',
  tlax: 'Tlaxcala',
  ver: 'Veracruz',
  'veracruz de ignacio de la llave': 'Veracruz',
  'veracruz llave': 'Veracruz',
  yuc: 'Yucatán',
  zac: 'Zacatecas',
  // Municipios: el catálogo del INEGI ya trae el nombre oficial, así que aquí
  // solo va la forma corta de uso común que devuelve el geocodificador.
  tlaquepaque: 'San Pedro Tlaquepaque',
};

/**
 * Devuelve el nombre canónico del catálogo para `valor`, tolerando las
 * distintas formas en que llega desde el geocodificador o desde registros
 * previos: mayúsculas/acentos ("JALISCO"), prefijos ("estado de Jalisco"),
 * abreviaturas y nombres constitucionales ("Jal.", "Michoacán de Ocampo") y
 * textos que contienen el nombre ("Guadalajara, Jalisco"). Si nada coincide,
 * regresa `valor` tal cual para no perder lo capturado.
 */
export function canonizar(valor: string, catalogo: string[]): string {
  const original = (valor ?? '').trim();
  if (!original || catalogo.length === 0) return original;

  const porClave = new Map(catalogo.map((c) => [claveUbicacion(c), c] as const));
  const buscar = (clave: string): string | undefined => {
    if (!clave) return undefined;
    const directo = porClave.get(clave);
    if (directo) return directo;
    const alias = ALIAS_UBICACION[clave];
    return alias ? porClave.get(claveUbicacion(alias)) : undefined;
  };

  const clave = claveUbicacion(original);
  const exacto = buscar(clave);
  if (exacto) return exacto;

  // Sin prefijo ("estado de jalisco" → "jalisco"); puede venir más de uno.
  let sinPrefijo = clave;
  for (let i = 0; i < 3; i++) {
    const recortado = sinPrefijo.replace(PREFIJOS_UBICACION, '');
    if (recortado === sinPrefijo) break;
    sinPrefijo = recortado;
    const hit = buscar(sinPrefijo);
    if (hit) return hit;
  }

  // El texto contiene el nombre canónico como palabra(s) completa(s):
  // "Guadalajara, Jalisco", "Jalisco, México". Gana la coincidencia más larga.
  let mejor: string | undefined;
  let longitudMejor = 0;
  for (const [claveCatalogo, nombre] of porClave) {
    if (claveCatalogo.length <= longitudMejor) continue;
    if (contienePalabra(clave, claveCatalogo) || contienePalabra(sinPrefijo, claveCatalogo)) {
      mejor = nombre;
      longitudMejor = claveCatalogo.length;
    }
  }
  if (mejor) return mejor;

  // Lo mismo, pero para alias contenidos ("Michoacán de Ocampo, México").
  for (const [claveAlias, destino] of Object.entries(ALIAS_UBICACION)) {
    if (claveAlias.length <= longitudMejor || claveAlias.length < 4) continue;
    const canonico = porClave.get(claveUbicacion(destino));
    if (!canonico) continue;
    if (contienePalabra(clave, claveAlias)) {
      mejor = canonico;
      longitudMejor = claveAlias.length;
    }
  }
  return mejor ?? original;
}

/**
 * Canoniza país, estado y municipio en cascada contra el catálogo: el estado
 * se busca entre los del país resuelto y el municipio entre los del estado
 * resuelto. Lo que no coincide se conserva tal cual.
 */
export function canonizarUbicacion(ubicacion: {
  pais: string;
  estado: string;
  municipio: string;
}): {
  pais: string;
  estado: string;
  municipio: string;
} {
  const pais = canonizar(ubicacion.pais, nombresPaises());
  const estado = canonizar(
    ubicacion.estado,
    estadosDe(pais).map((e) => e.nombre),
  );
  const municipio = canonizar(ubicacion.municipio, municipiosDe(pais, estado));
  return { pais, estado, municipio };
}

/**
 * Asegura que el valor vigente aparezca como opción del select aunque no esté
 * en el catálogo (registros previos capturados como texto libre).
 */
export function conValorActual(opciones: string[], actual: string): string[] {
  return actual && !opciones.includes(actual) ? [actual, ...opciones] : opciones;
}
