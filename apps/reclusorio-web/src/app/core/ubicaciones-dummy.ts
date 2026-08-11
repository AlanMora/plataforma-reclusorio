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
 * Devuelve el nombre canónico del catálogo si `valor` coincide (ignorando
 * acentos/mayúsculas); si no coincide, regresa `valor` tal cual para no
 * perder lo que devolvió el geocodificador.
 */
export function canonizar(valor: string, catalogo: string[]): string {
  if (!valor) return '';
  const hit = catalogo.find((c) => normalizarUbicacion(c) === normalizarUbicacion(valor));
  return hit ?? valor;
}
