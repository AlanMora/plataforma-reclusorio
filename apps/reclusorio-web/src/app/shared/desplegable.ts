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
  // Hacia arriba SOLO si el panel cabe completo: recortado por arriba no hay
  // forma de verlo; hacia abajo el contenedor con scroll sí permite llegar.
  return espacioAbajo < alturaEstimada && espacioArriba >= alturaEstimada;
}

/**
 * Alinea el panel con el borde derecho del botón cuando abrirlo desde la
 * izquierda haría que se recortara en el viewport o en el contenedor con
 * scroll más cercano. Es común en la última columna de los formularios.
 */
export function alinearHaciaIzquierda(boton: HTMLElement, anchoEstimado: number): boolean {
  const rect = boton.getBoundingClientRect();

  // Límite horizontal visible: viewport ∩ contenedor que recorta el panel.
  let limiteIzquierdo = 0;
  let limiteDerecho = window.innerWidth;
  let ancestro = boton.parentElement;
  while (ancestro) {
    const { overflowX, overflowY } = getComputedStyle(ancestro);
    if (
      overflowX === 'auto' ||
      overflowX === 'scroll' ||
      overflowX === 'hidden' ||
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'hidden'
    ) {
      const r = ancestro.getBoundingClientRect();
      limiteIzquierdo = Math.max(limiteIzquierdo, r.left);
      limiteDerecho = Math.min(limiteDerecho, r.right);
      break;
    }
    ancestro = ancestro.parentElement;
  }

  const espacioDesdeIzquierda = limiteDerecho - rect.left;
  const espacioHastaDerecha = rect.right - limiteIzquierdo;
  return espacioDesdeIzquierda < anchoEstimado && espacioHastaDerecha >= anchoEstimado;
}
