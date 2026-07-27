/** Contenido estándar del JWT emitido por auth-service. */
export interface JwtPayload {
  /** subject: id del usuario */
  sub: string;
  email?: string;
  /** id de la institución/tenant */
  tenantId?: string;
  roles: string[];
  permissions: string[];
  /** id de sesión, para revocación */
  sid?: string;
  iss?: string;
  iat?: number;
  exp?: number;
}

/** Usuario autenticado que queda disponible en el request. */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
}
