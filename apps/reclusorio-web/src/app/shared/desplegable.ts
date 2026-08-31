/**
 * Utilería de desplegables (select buscable / selector de fecha).
 *
 * Los paneles se posicionan con `absolute` (no `fixed`: el modal usa
 * backdrop-filter y se volvería el containing block). Cuando el botón está
 * cerca del borde inferior del contenedor con scroll (p. ej. el cuerpo del
 * modal) o del viewport, el panel abierto hacia abajo queda recortado; en ese
 * caso conviene abrirlo hacia arriba.
 */
export function abrirHaciaArriba(boton: HTMLElement, alturaEstimada: number): boolean {
  const rect = boton.getBoundingClientRect();

  // Límite inferior visible: viewport ∩ contenedor scrolleable más cercano.
  let limiteInferior = window.innerHeight;
  let limiteSuperior = 0;
  let ancestro = boton.parentElement;
  while (ancestro) {
    const { overflowY } = getComputedStyle(ancestro);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
      const r = ancestro.getBoundingClientRect();
      limiteInferior = Math.min(limiteInferior, r.bottom);
      limiteSuperior = Math.max(limiteSuperior, r.top);
      break; // el primer contenedor con scroll es el que recorta
    }
    ancestro = ancestro.parentElement;
  }

  const espacioAbajo = limiteInferior - rect.bottom;
  const espacioArriba = rect.top - limiteSuperior;
  return espacioAbajo < alturaEstimada && espacioArriba > espacioAbajo;
}
