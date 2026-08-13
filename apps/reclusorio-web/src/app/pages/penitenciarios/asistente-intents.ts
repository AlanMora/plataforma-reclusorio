/**
 * Intérprete de intenciones del asistente del mapa (P11).
 *
 * Traduce una frase hablada o escrita a un comando estructurado, con reglas
 * deterministas EN el navegador: ningún texto sale del sistema. El diseño deja
 * el punto de enchufe para un intérprete LLM posterior (misma salida
 * `ComandoAsistente`).
 */

/** Rango temporal detectado en la frase ("hoy", "este mes"…). */
export interface PeriodoConsulta {
  /** ISO inicial; null = todo el historial. */
  desde: string | null;
  /** ISO final exclusivo; null = hasta ahora. */
  hasta: string | null;
  /** Cómo se lee el periodo en la respuesta hablada. */
  etiqueta: string;
}

export type ComandoAsistente =
  | { tipo: 'ir_a_centro'; consulta: string }
  | { tipo: 'poblacion'; consulta: string }
  | { tipo: 'incidencias'; consulta: string; periodo: PeriodoConsulta }
  | { tipo: 'traslados'; consulta: string; periodo: PeriodoConsulta }
  | { tipo: 'resumen'; periodo: PeriodoConsulta }
  | { tipo: 'ver_todos' }
  | { tipo: 'ayuda' }
  | { tipo: 'desconocido'; texto: string };

/** Igual que la fn `normalizar` del backend: minúsculas, sin acentos ni ruido. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const inicioDeDia = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function detectarPeriodo(t: string): PeriodoConsulta {
  const ahora = new Date();
  const hoy = inicioDeDia(ahora);
  if (/\bhoy\b|del dia\b/.test(t)) {
    return { desde: hoy.toISOString(), hasta: null, etiqueta: 'hoy' };
  }
  if (/\bayer\b/.test(t)) {
    const ayer = new Date(hoy.getTime() - 86_400_000);
    return { desde: ayer.toISOString(), hasta: hoy.toISOString(), etiqueta: 'ayer' };
  }
  if (/\b(esta |ultima |de la )?semana\b/.test(t)) {
    const desde = new Date(hoy.getTime() - 7 * 86_400_000);
    return { desde: desde.toISOString(), hasta: null, etiqueta: 'en los últimos 7 días' };
  }
  if (/\b(este |ultimo |del )?mes\b/.test(t)) {
    const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return { desde: desde.toISOString(), hasta: null, etiqueta: 'este mes' };
  }
  if (/\b(este |del )?an(o|io)\b/.test(t)) {
    const desde = new Date(ahora.getFullYear(), 0, 1);
    return { desde: desde.toISOString(), hasta: null, etiqueta: 'este año' };
  }
  return { desde: null, hasta: null, etiqueta: 'en total' };
}

/** Palabras de relleno que no ayudan a identificar un centro. */
const RELLENO = new RegExp(
  '\\b(el|la|los|las|de|del|en|a|al|centro|penitenciario|penal|cereso|reclusorio|' +
    'llevame|lleva|llevanos|vamos|ve|ir|enfoca|centra|ubica|muestrame|muestra|ensename|' +
    'busca|buscar|donde|esta|queda|cuantas|cuantos|cuanta|cuanto|hay|tiene|hubo|' +
    'incidencias?|incidentes?|reportes?|poblacion|personas?|internos?|gente|reclusos?|' +
    'traslados?|trasladados?|' +
    'hoy|ayer|esta|este|ultima?o?s?|semana|mes|anio|ano|dia|dias|total|por|favor|dame|dime|quiero|ver)\\b',
  'g',
);

/** Lo que queda de la frase tras quitar relleno: candidato a nombre de centro. */
function extraerConsulta(t: string): string {
  return t.replace(RELLENO, ' ').replace(/\s+/g, ' ').trim();
}

export function interpretar(texto: string): ComandoAsistente {
  const t = normalizar(texto);
  if (!t) return { tipo: 'desconocido', texto };

  if (/\b(ayuda|que puedes hacer|que sabes hacer|comandos|como funciona|instrucciones)\b/.test(t)) {
    return { tipo: 'ayuda' };
  }
  if (/\b(ver todos|muestra todo|vista general|limpia|quita|reinicia|regresa|alejate)\b/.test(t)) {
    return { tipo: 'ver_todos' };
  }
  if (/\bresumen\b|\bnovedades\b|\bcomo esta todo\b|\bpanorama\b/.test(t)) {
    return { tipo: 'resumen', periodo: detectarPeriodo(t) };
  }
  if (/traslad/.test(t)) {
    return { tipo: 'traslados', consulta: extraerConsulta(t), periodo: detectarPeriodo(t) };
  }
  if (/incidenc|incidente|reporte/.test(t)) {
    return { tipo: 'incidencias', consulta: extraerConsulta(t), periodo: detectarPeriodo(t) };
  }
  if (/poblacion|internos|reclusos|cuantas personas|cuanta gente|quien esta|quienes estan/.test(t)) {
    return { tipo: 'poblacion', consulta: extraerConsulta(t) };
  }
  if (/llevame|llevanos|vamos a|\bve a\b|\bir a\b|enfoca|centra|ubica|muestrame|ensename|donde esta|donde queda|busca/.test(t)) {
    const consulta = extraerConsulta(t);
    if (consulta) return { tipo: 'ir_a_centro', consulta };
  }
  // Último recurso: si la frase completa parece solo un nombre, intentar ir ahí.
  const consulta = extraerConsulta(t);
  if (consulta && consulta.length >= 3) return { tipo: 'ir_a_centro', consulta };
  return { tipo: 'desconocido', texto };
}

/**
 * Elige el mejor centro para una consulta por traslape de tokens
 * normalizados. Devuelve null si ningún token coincide.
 */
export function resolverCentro<T extends { id: string; nombre: string }>(
  consulta: string,
  centros: T[],
): T | null {
  const tokens = normalizar(consulta)
    .split(' ')
    .filter((p) => p.length >= 3);
  if (tokens.length === 0) return null;
  let mejor: T | null = null;
  let mejorPuntos = 0;
  for (const centro of centros) {
    const nombre = normalizar(centro.nombre);
    const puntos = tokens.reduce((suma, tok) => suma + (nombre.includes(tok) ? 1 : 0), 0);
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejor = centro;
    }
  }
  return mejor;
}
