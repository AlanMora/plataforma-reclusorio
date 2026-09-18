import { Pipe, PipeTransform } from '@angular/core';

/** Caracteres visibles por defecto en una celda de texto libre. */
const LIMITE_POR_DEFECTO = 160;

/**
 * Recorta un texto libre para los listados: una descripción larga jamás
 * ensancha su columna ni empuja la tabla fuera del panel. El texto completo
 * se conserva en el `title` de la celda, así que no se pierde información.
 *
 * Corta en el último espacio disponible para no partir una palabra por la
 * mitad, salvo que el corte quedara demasiado corto.
 */
@Pipe({ name: 'resumen', standalone: true })
export class ResumenPipe implements PipeTransform {
  transform(texto: string | null | undefined, limite = LIMITE_POR_DEFECTO): string {
    const valor = (texto ?? '').trim();
    if (valor.length <= limite) return valor;
    const corte = valor.slice(0, limite);
    const espacio = corte.lastIndexOf(' ');
    const recorte = espacio > limite * 0.6 ? corte.slice(0, espacio) : corte;
    return `${recorte.trimEnd()}…`;
  }
}
