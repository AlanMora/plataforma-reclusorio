import { JwtClaims, TokenPair } from './models';

const CLAVE = 'reclusorio.tokens';

export function cargarTokens(): TokenPair | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const par = JSON.parse(crudo) as TokenPair;
    return par?.accessToken && par?.refreshToken ? par : null;
  } catch {
    return null;
  }
}

export function guardarTokens(par: TokenPair): void {
  localStorage.setItem(CLAVE, JSON.stringify(par));
}

export function limpiarTokens(): void {
  localStorage.removeItem(CLAVE);
}

/** Decodifica el payload del JWT (base64url) sin verificar firma — solo UI. */
export function decodificarJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** Verifica si el access token ya expiró considerando un margen de seguridad (por defecto 5s). */
export function esJwtExpirado(token?: string | null, margenSegundos = 5): boolean {
  if (!token) return true;
  const claims = decodificarJwt(token);
  if (!claims?.exp) return true;
  return Date.now() >= (claims.exp - margenSegundos) * 1000;
}
