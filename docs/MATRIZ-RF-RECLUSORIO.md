# Matriz de trazabilidad RF → implementación → verificación

Plataforma de Gestión de Reclusorio. Conforme al mandato §22.12 de la
Especificación de Requerimientos Funcionales v1.0.

Rutas relativas a `apps/`. Verificación: **E2E** = probado en vivo contra
Postgres/Redis/RabbitMQ/MinIO reales; **UT** = prueba unitaria; **BD** =
restricción verificada en la base de datos.

| RF | Implementación | Verificación |
|---|---|---|
| RF-SEG-001 | Permisos en JWT (`users.permissions` → claims); el frontend construye el menú con ellos | E2E (claims presentes en token) |
| RF-SEG-002/003 | `JwtAuthGuard` + `RolesGuard` + `PermissionsGuard` globales; `@RequirePermissions('modulo:accion')` en cada endpoint | E2E: POST sin permiso → 403 y cero filas |
| RF-GEN-001 | UUID v7 en todas las PKs (`@BeforeInsert`) | E2E |
| RF-GEN-002 / RF-CAT-010 | Tablas operativas guardan UUID de catálogo (FKs) | E2E + BD |
| RF-GEN-003 / RF-CAT-004 | Sin DELETE físico; `activo=false` | E2E |
| RF-GEN-004 | Validación DTO backend + reglas en services (autoridad final) | E2E |
| RF-GEN-005 | Errores RFC 9457 `application/problem+json` sin detalles internos | E2E + UT plataforma |
| RF-GEN-006 | 5 tablas asociativas con PK compuesta | BD + E2E |
| RF-GEN-007 / RF-ELE-001..005 | `GET /elementos/coincidencias` (número → nombre+adscripción), alta condicionada, asociaciones sin duplicar | E2E completo |
| RF-GEN-008 | `Persona.edad` getter calculado; sin columna | UT + E2E (edad 36) |
| RF-GEN-009 / RF-ARC-003 | Exclusividad: validación backend + `CHECK num_nonnulls(...)=1` | E2E (0 y 2 refs → 422) + BD |
| RF-GEN-010 | Esquema exacto del modelo; pendientes P1-P8 registrados sin asumir | revisión |
| RF-AUT-001..003 | `POST /auth/login` (argon2id, error genérico sin filtrar cuentas) | E2E |
| RF-SES-001..002 | Sesión Redis TTL 30 min (`JWT_REFRESH_TTL=30m`), access 10m | E2E (`expiresInSeconds`=1800) |
| RF-SES-005/008 | `POST /auth/refresh` rota y renueva vigencia 30 min | E2E (plataforma) |
| RF-SES-006/007 | `POST /auth/logout` revoca en Redis; TTL expira solo | E2E |
| RF-SES-009 / DP-009 | auth publica `session.revoked` → realtime emite a la sala `user:{id}` por WebSocket | E2E (log del consumidor) |
| RF-CUE-001 | `GET /auth/session` (vigencia restante) + `GET /users/me` (datos y permisos) | E2E |
| RF-CUE-002 | `POST /auth/change-password` (verifica actual, confirma, revoca sesiones) | E2E (401/204/login viejo 401) |
| Auditoría §17 / DP-003 | `security_audit_logs`: login exitoso/fallido, logout, revocación, cambio de contraseña — con IP | E2E (filas verificadas) |
| RF-UI-001..005 | Corresponde al frontend (F10, pendiente P8); rutas protegidas ya en backend | — |
| RF-NOT-001..004 | `GET /notifications/inbox` (búsqueda + paginación), `POST /inbox/:id/leida` | E2E completo |
| RF-PER-001..005 | `GET/POST/PATCH /personas` con búsqueda por nombre/apellidos/alias/CURP; DP-007 en validación | E2E (sin CURP → 400) |
| RF-PER-006..007 | `POST /personas/:id/domicilios` (números alfanuméricos) | E2E ("12-A", "S/N") |
| RF-PER-008 / RF-ARC-004 | `POST /archivos` con `idPersona`; múltiples permitidos | E2E |
| RF-IEG-001..005 | `personas/:id/ingresos-egresos` + catálogos activos + archivos por `idIngresoEgreso` | E2E |
| RF-MOV-001..005 | `personas/:id/movimientos` (tipo/motivo fijos, origen/destino centros) | E2E |
| RF-AUD-001..008 | `personas/:id/audiencias`, coherencia próxima audiencia, `audiencias/:id/elementos` | E2E (NO+fecha → 422; duplicado → 422) |
| RF-TRA-001..007 | `personas/:id/traslados` (tipo/destino/estatus), `traslados/:id/elementos` | E2E |
| RF-INC-001..009 | `POST /incidencias` sin personas + asociaciones (personas/autoridades/elementos con `primerRespondiente`) | E2E completo |
| RF-ARC-001..002 | Subida a MinIO, metadatos completos, SHA-256 | E2E (hash local = hash servidor) |
| RF-ARC-005..007 | Listado por entidad, URL presignada, desactivación bloquea | E2E |
| RF-CAT-001..007 | CRUD catálogos administrables, dedup normalizado, semillas completas (284 valores) | E2E + UT (`normalizar`) |
| RF-CAT-008..009 | Fijos solo lectura; sin endpoint de edición | E2E + revisión |
| DP-010 | `PaginationQueryDto` en todos los listados | E2E |

## Pendientes que siguen requiriendo decisión del equipo

P1 obligatoriedad en esquema · P2 listados completos de centros/destinos/tipos de audiencia · P3 valores de Gender/MaritalStatus · P4 baja de personas · P5 bitácora de dominio · P6 política de archivos · P7 política de contraseñas completa · P8 framework del frontend (F10). Detalle en `docs/PLAN-RECLUSORIO.md`.
