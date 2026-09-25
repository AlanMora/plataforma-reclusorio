/** Alcance organizacional del usuario (§14). */
export type OrgScope = 'own_ou' | 'assigned_ous' | 'all_ous';

/** Contenido estándar del JWT emitido por auth-service. */
export interface JwtPayload {
  /** subject: id del usuario */
  sub: string;
  /** nombre de usuario con el que se inicia sesión */
  username?: string;
  /** nombre completo del usuario, si se capturó */
  nombre?: string;
  /** true mientras el usuario deba cambiar su contraseña temporal */
  mustChangePassword?: boolean;
  /** tenant ACTIVO de la sesión */
  tenantId?: string;
  /** unidades organizacionales autorizadas (§14) */
  ous?: string[];
  /** alcance organizacional resumido (§14) */
  scope?: OrgScope;
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
  username?: string;
  mustChangePassword?: boolean;
  tenantId?: string;
  organizationalUnitIds: string[];
  scope: OrgScope;
  roles: string[];
  permissions: string[];
  sessionId?: string;
}
