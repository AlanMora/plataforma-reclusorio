/**
 * Contratos de eventos de dominio compartidos entre servicios. Publicados en
 * RabbitMQ con routing keys `<agregado>.<accion>` (p.ej. `user.registered`).
 *
 * Reglas:
 *  - Añade campos de forma retrocompatible (opcionales).
 *  - No elimines campos sin versionar la routing key.
 */

/**
 * Contrato estándar de evento (§7.2). Inmutable, versionado y validable.
 * `eventType` sigue la convención `Nombre.vN` (p.ej. `IncidentCreated.v1`).
 */
export interface DomainEvent<T = unknown> {
  /** Identificador único del evento (idempotencia / Inbox). */
  eventId: string;
  /** Tipo versionado del evento, p.ej. "user.registered.v1". */
  eventType: string;
  /** Momento de emisión en ISO-8601 (UTC). */
  occurredAt: string;
  /** Servicio productor del evento. */
  producer: string;
  /** Correlación con la operación distribuida que lo originó. */
  correlationId?: string;
  /** Comando o evento que causó éste (cadena de causalidad). */
  causationId?: string;
  /** Traza OpenTelemetry asociada. */
  traceId?: string;
  /** Tenant dueño del evento. */
  tenantId?: string;
  /** Agregado/entidad al que pertenece el evento. */
  aggregateId?: string;
  /** Versión del schema del payload. */
  schemaVersion: number;
  /** Carga útil específica del evento. */
  payload: T;
}

/** Routing keys canónicas por dominio. */
export const EventNames = {
  UserRegistered: 'user.registered',
  UserPasswordChanged: 'user.password_changed',
  /** Login exitoso: alimenta la proyección de destinatarios de notificaciones. */
  UserLoggedIn: 'user.logged_in',
  SessionRevoked: 'session.revoked',
  ConfigurationPublished: 'configuration.published',
  NotificationRequested: 'notification.requested',
  /** Fila nueva en la bandeja de un usuario: realtime la empuja a su campana. */
  NotificationCreated: 'notification.created',
  FileUploaded: 'file.uploaded',
  IntegrationInbound: 'integration.inbound',
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];

// ---- Payloads de ejemplo (extiéndelos por proyecto) --------------------------

export interface NotificationRequestedPayload {
  channel: 'email' | 'sms' | 'push' | 'internal';
  /** userId destino, o '*' para difundir a todos los usuarios conocidos. */
  to: string;
  template: string;
  variables?: Record<string, unknown>;
}

export interface UserLoggedInPayload {
  userId: string;
  email: string;
}

/** Notificación persistida en la bandeja; realtime la emite a `user:{userId}`. */
export interface NotificationCreatedPayload {
  id: string;
  userId: string;
  titulo?: string;
  mensaje: string;
  url?: string;
}

export interface FileUploadedPayload {
  fileId: string;
  bucket: string;
  key: string;
  size: number;
  contentType: string;
}
