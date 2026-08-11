import { PAISES_DUMMY } from './ubicaciones-dummy';

/**
 * DATA DUMMY de opciones de persona (género, estado civil, nivel educativo,
 * nacionalidad y estado de nacimiento) para los selects del formulario.
 *
 * ⚠️ TEMPORAL: los valores oficiales de género/estado civil siguen pendientes
 * (P3 del PLAN — el modelo los declara ENUM sin definir valores) y el resto
 * no tiene catálogo aprobado. Sustituir por los seeders/catálogos reales
 * cuando el equipo los entregue; los componentes ya consumen listas planas,
 * así que solo cambia la fuente.
 */

export const GENEROS_DUMMY = ['Masculino', 'Femenino', 'No binario', 'Otro'];

export const ESTADOS_CIVILES_DUMMY = [
  'Soltero(a)',
  'Casado(a)',
  'Unión libre',
  'Divorciado(a)',
  'Separado(a)',
  'Viudo(a)',
];

export const NIVELES_EDUCATIVOS_DUMMY = [
  'Sin escolaridad',
  'Primaria',
  'Secundaria',
  'Preparatoria o bachillerato',
  'Carrera técnica',
  'Licenciatura',
  'Maestría',
  'Doctorado',
];

export const NACIONALIDADES_DUMMY = [
  'Mexicana',
  'Estadounidense',
  'Guatemalteca',
  'Hondureña',
  'Salvadoreña',
  'Nicaragüense',
  'Cubana',
  'Colombiana',
  'Venezolana',
  'Otra',
];

/** Los 32 estados de México (del dummy de ubicaciones) + nacimiento en el extranjero. */
export const ESTADOS_NACIMIENTO_DUMMY = [
  ...(PAISES_DUMMY.find((p) => p.nombre === 'México')?.estados.map((e) => e.nombre) ?? []),
  'Extranjero',
];
