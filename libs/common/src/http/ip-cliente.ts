/** Lo mínimo de un request de Express que se necesita para resolver la IP. */
interface RequestConIp {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * IP real del cliente detrás de nginx → gateway → servicio.
 *  1. `X-Real-IP`: lo fija el nginx del frontend con `$remote_addr` (el
 *     cliente no puede falsificarlo, nginx lo sobrescribe).
 *  2. Último salto de `X-Forwarded-For`: lo agrega el gateway (xfwd) con la
 *     dirección que ve; el PRIMERO no sirve porque lo puede mandar el cliente.
 *  3. `req.ip` si la petición llega directo al servicio.
 */
export function ipCliente(req: RequestConIp): string | undefined {
  const real = primero(req.headers['x-real-ip'])?.trim();
  if (real) return real;
  const saltos = primero(req.headers['x-forwarded-for'])
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (saltos?.length) return saltos[saltos.length - 1];
  return req.ip;
}
