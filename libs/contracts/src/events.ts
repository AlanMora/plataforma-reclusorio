/**
 * Contratos de eventos de dominio compartidos entre servicios. Publicados en
 * RabbitMQ con routing keys `<agregado>.<accion>` (p.ej. `user.registered`).
 *
 * Reglas:
 *  - Añade campos de forma retrocompatible (opcionales).
 *  - No elimines campos sin versionar la routing key.
 */

export interface DomainEvent<T = unknown> {
  /** Nombre del evento / routing key, p.ej. "user.registered". */
  name: string;
  /** Identificador único del evento (idempotencia). */
  eventId: string;
  /** Momento de emisión en ISO-8601. */
  occurredAt: string;
  /** Correlación con la petición que originó el evento. */
  correlationId?: string;
  /** Tenant/institución dueña del evento. */
  tenantId?: string;
  /** Carga útil específica del evento. */
  payload: T;
}

/** Routing keys canónicas por dominio. */
export const EventNames = {
  UserRegistered: 'user.registered',
  UserPasswordChanged: 'user.password_changed',
  SessionRevoked: 'session.revoked',
  ConfigurationPublished: 'configuration.published',
  NotificationRequested: 'notification.requested',
  FileUploaded: 'file.uploaded',
  IntegrationInbound: 'integration.inbound',
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];

// ---- Payloads de ejemplo (extiéndelos por proyecto) --------------------------

export interface NotificationRequestedPayload {
  channel: 'email' | 'sms' | 'push' | 'internal';
  to: string;
  template: string;
  variables?: Record<string, unknown>;
}

export interface FileUploadedPayload {
  fileId: string;
  bucket: string;
  key: string;
  size: number;
  contentType: string;
}
