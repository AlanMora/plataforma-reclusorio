import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Traducción al español de los mensajes POR DEFECTO de class-validator
 * (RF-GEN-004: el backend es la autoridad de validación y debe responder
 * mensajes presentables al usuario).
 *
 * Funciona sobre el mensaje ya generado (plantillas en inglés de
 * class-validator): si un patrón coincide se traduce; si no coincide ninguno
 * el mensaje pasa intacto, de modo que los mensajes personalizados escritos
 * en español en los DTOs (`{ message: '...' }`) nunca se alteran.
 *
 * El orden importa: los patrones más específicos van primero.
 */
const TRADUCCIONES: ReadonlyArray<[RegExp, string]> = [
  [/^(.+) must be a valid ISO 8601 date string$/, '$1 debe ser una fecha válida (formato AAAA-MM-DD)'],
  [/^(.+) must be longer than or equal to (\d+) and shorter than or equal to (\d+) characters$/, '$1 debe tener entre $2 y $3 caracteres'],
  [/^(.+) must be longer than or equal to (\d+) characters$/, '$1 debe tener al menos $2 caracteres'],
  [/^(.+) must be shorter than or equal to (\d+) characters$/, '$1 debe tener como máximo $2 caracteres'],
  [/^(.+) must be a string$/, '$1 debe ser un texto'],
  [/^(.+) must be a UUID$/, '$1 debe ser un identificador (UUID) válido'],
  [/^(.+) should not be empty$/, '$1 no debe estar vacío'],
  [/^(.+) should not be null or undefined$/, '$1 es obligatorio'],
  [/^(.+) must be a boolean value$/, '$1 debe ser verdadero o falso'],
  [/^(.+) must be an object$/, '$1 debe ser un objeto'],
  [/^(.+) must be an email$/, '$1 debe ser un correo electrónico válido'],
  [/^(.+) must be an integer number$/, '$1 debe ser un número entero'],
  [/^(.+) must be a number conforming to the specified constraints$/, '$1 debe ser un número'],
  [/^(.+) must be a positive number$/, '$1 debe ser un número positivo'],
  [/^(.+) must not be less than (-?[\d.]+)$/, '$1 no debe ser menor que $2'],
  [/^(.+) must not be greater than (-?[\d.]+)$/, '$1 no debe ser mayor que $2'],
  [/^(.+) must match .+ regular expression$/, '$1 no tiene el formato requerido'],
  [/^(.+) must be one of the following values: (.*)$/, '$1 debe ser uno de los siguientes valores: $2'],
  [/^(.+) must be an array$/, '$1 debe ser una lista'],
  [/^(.+) must contain at least (\d+) elements$/, '$1 debe contener al menos $2 elementos'],
  [/^(.+) must contain no more than (\d+) elements$/, '$1 debe contener como máximo $2 elementos'],
  [/^(.+) must be a Date instance$/, '$1 debe ser una fecha válida'],
  [/^(.+) must be a valid enum value$/, '$1 no es un valor permitido'],
  [/^(.+) must be a URL address$/, '$1 debe ser una URL válida'],
  [/^(.+) must be a valid phone number$/, '$1 debe ser un número telefónico válido'],
  [/^property (.+) should not exist$/, 'la propiedad $1 no está permitida'],
  [/^nested property (.+) must be either object or array$/, '$1 debe ser un objeto o una lista'],
];

/** Traduce un mensaje de class-validator al español; si no lo reconoce, lo deja igual. */
export function traducirMensajeValidacion(mensaje: string): string {
  for (const [patron, reemplazo] of TRADUCCIONES) {
    if (patron.test(mensaje)) return mensaje.replace(patron, reemplazo);
  }
  return mensaje;
}

/**
 * Aplana el árbol de errores (incluyendo DTOs anidados, prefijando la ruta
 * `padre.hijo` como hace el ValidationPipe de Nest) y traduce cada mensaje.
 */
function aplanarYTraducir(errores: ValidationError[], ruta = ''): string[] {
  const mensajes: string[] = [];
  for (const error of errores) {
    const rutaActual = ruta ? `${ruta}.${error.property}` : error.property;
    if (error.constraints) {
      for (const mensaje of Object.values(error.constraints)) {
        const traducido = traducirMensajeValidacion(mensaje);
        // Los mensajes por defecto inician con el nombre de la propiedad; en
        // anidados se antepone la ruta del padre para ubicar el campo.
        mensajes.push(ruta && traducido.startsWith(error.property) ? `${ruta}.${traducido}` : traducido);
      }
    }
    if (error.children?.length) {
      mensajes.push(...aplanarYTraducir(error.children, rutaActual));
    }
  }
  return mensajes;
}

/**
 * exceptionFactory para el ValidationPipe global: produce el mismo
 * BadRequestException con arreglo de mensajes que Nest genera por defecto
 * (el AllExceptionsFilter lo convierte en problem+json con `errors`),
 * pero con los mensajes en español.
 */
export function fabricaErroresValidacion(errores: ValidationError[]): BadRequestException {
  return new BadRequestException(aplanarYTraducir(errores));
}
