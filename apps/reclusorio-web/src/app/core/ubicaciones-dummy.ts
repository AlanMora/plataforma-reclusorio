/**
 * DATA DUMMY de ubicaciones (país → estado → municipio) para los selects del
 * formulario de domicilio.
 *
 * ⚠️ TEMPORAL: sustituir por los seeders/catálogos reales cuando el equipo los
 * entregue (P9 del PLAN). La forma esperada del catálogo real es la misma:
 * país con sus estados y cada estado con sus municipios, de modo que solo haya
 * que cambiar la fuente (endpoint de catálogos) sin tocar los componentes.
 */

export interface EstadoUbicacion {
  nombre: string;
  municipios: string[];
}

export interface PaisUbicacion {
  nombre: string;
  estados: EstadoUbicacion[];
}

export const PAISES_DUMMY: PaisUbicacion[] = [
  {
    nombre: 'México',
    estados: [
      { nombre: 'Aguascalientes', municipios: ['Aguascalientes', 'Calvillo', 'Jesús María'] },
      { nombre: 'Baja California', municipios: ['Mexicali', 'Tijuana', 'Ensenada'] },
      { nombre: 'Baja California Sur', municipios: ['La Paz', 'Los Cabos', 'Comondú'] },
      { nombre: 'Campeche', municipios: ['Campeche', 'Carmen', 'Champotón'] },
      {
        nombre: 'Chiapas',
        municipios: ['Tuxtla Gutiérrez', 'San Cristóbal de las Casas', 'Tapachula'],
      },
      { nombre: 'Chihuahua', municipios: ['Chihuahua', 'Ciudad Juárez', 'Delicias'] },
      {
        nombre: 'Ciudad de México',
        municipios: [
          'Álvaro Obregón',
          'Azcapotzalco',
          'Benito Juárez',
          'Coyoacán',
          'Cuauhtémoc',
          'Gustavo A. Madero',
          'Iztapalapa',
          'Miguel Hidalgo',
          'Tlalpan',
          'Xochimilco',
        ],
      },
      { nombre: 'Coahuila', municipios: ['Saltillo', 'Torreón', 'Monclova'] },
      { nombre: 'Colima', municipios: ['Colima', 'Manzanillo', 'Tecomán'] },
      { nombre: 'Durango', municipios: ['Durango', 'Gómez Palacio', 'Lerdo'] },
      { nombre: 'Guanajuato', municipios: ['Guanajuato', 'León', 'Irapuato', 'Celaya'] },
      { nombre: 'Guerrero', municipios: ['Chilpancingo', 'Acapulco', 'Iguala'] },
      { nombre: 'Hidalgo', municipios: ['Pachuca', 'Tulancingo', 'Tula de Allende'] },
      {
        nombre: 'Jalisco',
        municipios: ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Puerto Vallarta'],
      },
      {
        nombre: 'Estado de México',
        municipios: ['Toluca', 'Ecatepec', 'Naucalpan', 'Nezahualcóyotl', 'Tlalnepantla'],
      },
      { nombre: 'Michoacán', municipios: ['Morelia', 'Uruapan', 'Zamora'] },
      { nombre: 'Morelos', municipios: ['Cuernavaca', 'Jiutepec', 'Cuautla'] },
      { nombre: 'Nayarit', municipios: ['Tepic', 'Bahía de Banderas', 'Xalisco'] },
      {
        nombre: 'Nuevo León',
        municipios: [
          'Monterrey',
          'San Nicolás de los Garza',
          'Guadalupe',
          'Apodaca',
          'San Pedro Garza García',
        ],
      },
      { nombre: 'Oaxaca', municipios: ['Oaxaca de Juárez', 'Salina Cruz', 'Juchitán'] },
      { nombre: 'Puebla', municipios: ['Puebla', 'Tehuacán', 'Cholula'] },
      { nombre: 'Querétaro', municipios: ['Querétaro', 'San Juan del Río', 'Corregidora'] },
      { nombre: 'Quintana Roo', municipios: ['Othón P. Blanco', 'Benito Juárez', 'Solidaridad'] },
      {
        nombre: 'San Luis Potosí',
        municipios: ['San Luis Potosí', 'Soledad de Graciano Sánchez', 'Ciudad Valles'],
      },
      { nombre: 'Sinaloa', municipios: ['Culiacán', 'Mazatlán', 'Ahome'] },
      { nombre: 'Sonora', municipios: ['Hermosillo', 'Cajeme', 'Nogales'] },
      { nombre: 'Tabasco', municipios: ['Centro', 'Cárdenas', 'Comalcalco'] },
      { nombre: 'Tamaulipas', municipios: ['Ciudad Victoria', 'Reynosa', 'Matamoros', 'Tampico'] },
      { nombre: 'Tlaxcala', municipios: ['Tlaxcala', 'Apizaco', 'Huamantla'] },
      { nombre: 'Veracruz', municipios: ['Xalapa', 'Veracruz', 'Coatzacoalcos', 'Córdoba'] },
      { nombre: 'Yucatán', municipios: ['Mérida', 'Valladolid', 'Progreso'] },
      { nombre: 'Zacatecas', municipios: ['Zacatecas', 'Fresnillo', 'Guadalupe'] },
    ],
  },
  {
    nombre: 'Estados Unidos',
    estados: [
      { nombre: 'Texas', municipios: ['Houston', 'San Antonio', 'El Paso'] },
      { nombre: 'California', municipios: ['Los Ángeles', 'San Diego', 'Sacramento'] },
      { nombre: 'Arizona', municipios: ['Phoenix', 'Tucson', 'Yuma'] },
    ],
  },
  {
    nombre: 'Guatemala',
    estados: [
      { nombre: 'Guatemala', municipios: ['Ciudad de Guatemala', 'Mixco', 'Villa Nueva'] },
      { nombre: 'Quetzaltenango', municipios: ['Quetzaltenango', 'Coatepeque'] },
    ],
  },
  {
    nombre: 'Honduras',
    estados: [
      { nombre: 'Francisco Morazán', municipios: ['Tegucigalpa', 'Valle de Ángeles'] },
      { nombre: 'Cortés', municipios: ['San Pedro Sula', 'Puerto Cortés'] },
    ],
  },
  {
    nombre: 'Colombia',
    estados: [
      { nombre: 'Cundinamarca', municipios: ['Bogotá', 'Soacha', 'Chía'] },
      { nombre: 'Antioquia', municipios: ['Medellín', 'Envigado', 'Bello'] },
    ],
  },
];

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
  const p = PAISES_DUMMY.find(
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
  // Municipios con nombre largo habitual en geocodificadores
  'san pedro tlaquepaque': 'Tlaquepaque',
  'los angeles': 'Los Ángeles',
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
  const pais = canonizar(
    ubicacion.pais,
    PAISES_DUMMY.map((p) => p.nombre),
  );
  const estado = canonizar(
    ubicacion.estado,
    estadosDe(pais).map((e) => e.nombre),
  );
  const municipio = canonizar(ubicacion.municipio, municipiosDe(pais, estado));
  return { pais, estado, municipio };
}

/**
 * Asegura que el valor vigente aparezca como opción del select aunque no esté
 * en el catálogo dummy (registros previos capturados como texto libre).
 */
export function conValorActual(opciones: string[], actual: string): string[] {
  return actual && !opciones.includes(actual) ? [actual, ...opciones] : opciones;
}
