/**
 * Tipos del contrato backend. Espejo fiel del Modelo de Datos Consolidado:
 * nombres de campos EXACTOS (camelCase: idPersona, primerNombre...).
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  correlationId?: string;
  timestamp?: string;
}

export interface Paginado<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Error RFC 9457 (application/problem+json) que emite la plataforma. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  correlationId?: string;
  code?: string;
  errors?: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** TTL del access token con sufijo, p.ej. "600s" — informativo. */
  expiresIn?: string;
}

export interface JwtClaims {
  sub: string;
  email?: string;
  sid?: string;
  tenantId?: string | null;
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface SesionInfo {
  sessionId: string;
  /** Vigencia restante en segundos (RF-CUE-001); -2 si ya no existe. */
  expiresInSeconds: number;
}

export interface SesionActiva {
  sessionId: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt?: string;
}

export interface UsuarioMe {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt?: string;
}

// ------------------------- dominio reclusorio -------------------------

export interface Persona {
  idPersona: string;
  primerNombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string;
  alias?: string;
  curp?: string;
  genero?: string;
  estadoCivil?: string;
  nivelEducativo?: string;
  ocupacion?: string;
  nacionalidad?: string;
  estadoNacimiento?: string;
  numeroTelefono?: string;
  /** SIEMPRE calculada por el backend, nunca persistida (RF-GEN-008). */
  edad?: number | null;
  fechaRegistro?: string;
  fechaActualizacion?: string;
}

export interface Domicilio {
  idDomicilio?: string;
  idPersona?: string;
  calle?: string;
  numeroExterior?: string;
  numeroInterior?: string;
  cruce1?: string;
  cruce2?: string;
  colonia?: string;
  estado?: string;
  municipio?: string;
  pais?: string;
  /** Coordenadas capturadas desde el mapa (pueden no existir en registros previos). */
  latitud?: number | null;
  longitud?: number | null;
}

export interface PersonaDetalle extends Persona {
  domicilios: Domicilio[];
}

export interface Elemento {
  idElemento: string;
  grado?: string;
  primerNombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  numeroElemento?: string;
  adscripcion?: string;
}

export interface IngresoEgreso {
  idIngresoEgreso: string;
  idPersona: string;
  idTipoIngresoEgreso: string;
  fecha: string;
  idCentroPenitenciario: string;
  ubicacion?: string;
  autoridad?: string;
  idDelito?: string;
}

export interface Movimiento {
  idMovimiento: string;
  idPersona: string;
  idTipoMovimiento: string;
  fecha: string;
  idCentroOrigen: string;
  idCentroDestino: string;
  ubicacion?: string;
  idMotivoMovimiento: string;
}

export interface Audiencia {
  idAudiencia: string;
  idPersona: string;
  fecha: string;
  ca?: string;
  ci?: string;
  idFormaIngresoAudiencia: string;
  idJuzgado: string;
  idJuezJuzgado: string;
  nombreJuez?: string;
  idTipoAudiencia: string;
  idModalidadAudiencia: string;
  idResolucionAudiencia?: string;
  observaciones?: string;
  idProximaAudiencia: string;
  fechaSiguienteAudiencia?: string;
  /** Presente solo en el detalle GET /audiencias/:id. */
  elementos?: string[];
}

export interface Traslado {
  idTraslado: string;
  idPersona: string;
  fecha: string;
  idTipoTraslado: string;
  idDestinoTraslado: string;
  descripcion?: string;
  unidades?: string;
  observaciones?: string;
  idEstatusTraslado: string;
  /** Presente solo en el detalle GET /traslados/:id. */
  elementos?: string[];
}

export interface Incidencia {
  idIncidencia: string;
  idCentroPenitenciario: string;
  fecha: string;
  idTipoIncidencia: string;
  descripcion: string;
  iph?: string;
  /** Nombre libre cuando el elemento no está registrado (RF-INC-007). */
  primerRespondiente?: string;
  narrativa?: string;
}

export interface IncidenciaDetalle extends Incidencia {
  personas: string[];
  autoridades: string[];
  elementos: { idElemento: string; primerRespondiente: boolean }[];
}

export type ReferenciaArchivo =
  | 'idPersona'
  | 'idIngresoEgreso'
  | 'idMovimiento'
  | 'idAudiencia'
  | 'idTraslado'
  | 'idIncidencia';

export interface Archivo {
  idArchivo: string;
  nombreOriginal: string;
  nombreAlmacenado?: string;
  tipoArchivo: string;
  mimeType: string;
  extension: string;
  tamanoBytes: number;
  hashSha256: string;
  descripcion?: string;
  activo: boolean;
  fechaRegistro?: string;
}

/** Valor de catálogo normalizado para la UI (el PK real varía por tabla). */
export interface ValorCatalogo {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}
