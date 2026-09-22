import { estadosDeMexico } from './ubicaciones';

/**
 * Opciones de los selects del formulario de persona.
 *
 * Dos orígenes distintos, y conviene no confundirlos:
 *
 * - NACIONALIDADES y OCUPACIONES viven en `persona-opciones.data.ts`, generado
 *   desde fuentes oficiales por `tools/catalogos/generar-catalogos.py`
 *   (gentilicios de Wikipedia en español; CIUO-08 vía ESCO).
 * - GENEROS, ESTADOS_CIVILES y NIVELES_EDUCATIVOS siguen siendo provisionales:
 *   el Modelo de Datos v1.0 los declara ENUM sin enumerar sus valores (P3 del
 *   PLAN) y no hay catálogo aprobado. Se sustituyen cuando el equipo los
 *   entregue; los componentes ya consumen listas planas.
 */

export { NACIONALIDADES, OCUPACIONES } from './persona-opciones.data';

/** Pendiente P3: valores del ENUM Gender sin definir en el Modelo de Datos. */
export const GENEROS_DUMMY = ['Masculino', 'Femenino', 'No binario', 'Otro'];

/** Pendiente P3: valores del ENUM MaritalStatus sin definir en el Modelo de Datos. */
export const ESTADOS_CIVILES_DUMMY = [
  'Soltero(a)',
  'Casado(a)',
  'Unión libre',
  'Divorciado(a)',
  'Separado(a)',
  'Viudo(a)',
];

/** Sin catálogo aprobado; escala de la SEP, de menor a mayor. */
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

/**
 * Las 32 entidades federativas (catálogo del INEGI) más "Extranjero" para
 * quien nació fuera del país. Es función, no constante, porque el catálogo de
 * ubicaciones se carga al arrancar la aplicación.
 */
export function estadosNacimiento(): string[] {
  return [...estadosDeMexico(), 'Extranjero'];
}
