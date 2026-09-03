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
| RF-GEN-004 | Validación DTO backend + reglas en services (autoridad final); QA 03/09 (reemplaza al 31/08): `fechaNacimiento` no admite fechas futuras — hoy sí se permite (`validarFechaNacimiento` en crear y modificar); `numeroTelefono` acotado a 10 dígitos (DTOs) | E2E (futura → 422; teléfono >10 → 400) |
| RF-GEN-005 | Errores RFC 9457 `application/problem+json` sin detalles internos | E2E + UT plataforma |
| RF-GEN-006 | 5 tablas asociativas con PK compuesta | BD + E2E |
| RF-GEN-007 / RF-ELE-001..005 | `GET /elementos/coincidencias` (número → nombre+adscripción), alta condicionada, asociaciones sin duplicar; QA 31/08: `GET /elementos/adscripciones` (catálogo DERIVADO de valores distintos del padrón, sin tabla nueva) consumido por el select con escritura libre del módulo Elementos | E2E completo (adscripción nueva aparece en el derivado) |
| RF-GEN-008 | `Persona.edad` getter calculado; sin columna. QA 31/08: edad visible EN VIVO al capturar la fecha (`persona-form`) y respaldo calculado en cliente (`core/edad.ts`) en listado y detalle | UT + E2E (edad 36 en alta, listado y detalle) |
| RF-GEN-009 / RF-ARC-003 | Exclusividad: validación backend + `CHECK num_nonnulls(...)=1` | E2E (0 y 2 refs → 422) + BD |
| RF-GEN-010 | Esquema exacto del modelo; pendientes P1-P8 registrados sin asumir | revisión |
| RF-AUT-001..003 | `POST /auth/login` (argon2id, error genérico sin filtrar cuentas) | E2E |
| RF-SES-001..002 | Sesión Redis TTL 30 min (`JWT_REFRESH_TTL=30m`), access 10m | E2E (`expiresInSeconds`=1800) |
| RF-SES-005/008 | `POST /auth/refresh` rota y renueva vigencia 30 min | E2E (plataforma) |
| RF-SES-006/007 | `POST /auth/logout` revoca en Redis; TTL expira solo | E2E |
| RF-SES-009 / DP-009 | auth publica `session.revoked` → realtime emite a la sala `user:{id}` por WebSocket; el cierre GLOBAL (revoke-all y cambio de contraseña) también publica un evento por sesión (`AuthService.revokeAllForUser`) | E2E navegador: revoke-all expulsa la sesión abierta sin recargar |
| RF-CUE-001 | `GET /auth/session` (vigencia restante) + `GET /users/me` (datos y permisos) | E2E |
| RF-CUE-002 | `POST /auth/change-password` (verifica actual, confirma, revoca sesiones) | E2E (401/204/login viejo 401) |
| Auditoría §17 / DP-003 | `security_audit_logs`: login exitoso/fallido, logout, revocación, cambio de contraseña — con IP | E2E (filas verificadas) |
| RF-UI-001..005 | F10 `reclusorio-web/` (Angular 22 + Tailwind 4): login (`pages/login`), layout privado (`layout/shell` + `authGuard`), sidebar construido con los claims `permissions` (RF-SEG-001) + `permisoGuard`/`*rwPermiso` por módulo, aviso de expiración a 5 min con extensión (`core/session.service`), manejo de errores problem+json (`core/problem.ts` + alertas/toasts). QA 31/08: selects y calendarios se abren hacia arriba cuando no hay espacio abajo (`shared/desplegable.ts` — antes quedaban recortados en modales con scroll); selector de fecha con máximo configurable (`[max]`) | build prod + lint; revisión manual |
| RF-SES-002/008 (cliente) | Cuenta regresiva sincronizada con `GET /auth/session`; refresh rota tokens y reinicia 30 min (`core/auth.service` single-flight; reintento ante 401 en `auth.interceptor`) | build + revisión |
| RF-SES-009 (cliente) | `core/realtime.service`: socket.io autenticado con el access token; al recibir `session.revoked` de la propia sesión fuerza logout inmediato con motivo | build + revisión |
| RF-NOT-001..004 | `GET /notifications/inbox` (búsqueda + paginación), `POST /inbox/:id/leida` | E2E completo |
| RF-PER-001..005 | `GET/POST/PATCH /personas` con búsqueda por nombre/apellidos/alias/CURP; DP-007 en validación. QA 31/08 ajustado el 03/09: selector de nacimiento sin fechas futuras (hoy permitido, `soloPasado`), teléfono a 10 dígitos, y ocupación/nacionalidad con texto libre además del catálogo (`permitirLibre` del select buscable) | E2E (sin CURP → 400; ocupación/nacionalidad libres guardadas) |
| RF-PER-006..007 | `POST /personas/:id/domicilios` (números alfanuméricos). QA 31/08: país/estado/municipio aceptan texto libre además del catálogo dummy (P9) | E2E ("12-A", "S/N"; Belice/Cayo/San Ignacio fuera de catálogo) |
| RF-PER-008 / RF-ARC-004 | `POST /archivos` con `idPersona`; múltiples permitidos | E2E |
| RF-IEG-001..005 | `personas/:id/ingresos-egresos` + catálogos activos + archivos por `idIngresoEgreso` | E2E |
| RF-MOV-001..005 | `personas/:id/movimientos` (tipo/motivo fijos, origen/destino centros) | E2E |
| RF-AUD-001..008 | `personas/:id/audiencias`, coherencia próxima audiencia, `audiencias/:id/elementos`. QA 31/08: jueces en orden natural "menor a mayor" (backend `ORDER BY` numérico inicial + `Intl.Collator numeric` en frontend) y etiqueta «Nombre del juez» sin "(texto)" | E2E (NO+fecha → 422; duplicado → 422; jueces 1..12 en orden) |
| RF-TRA-001..007 | `personas/:id/traslados` (tipo/destino/estatus), `traslados/:id/elementos` | E2E |
| RF-INC-001..009 | `POST /incidencias` sin personas + asociaciones (personas/autoridades/elementos con `primerRespondiente`); `GET /incidencias?idPersona=` alimenta el tab Incidencias del expediente (consulta + asociación de elementos desde ahí). QA 31/08: personas, autoridades de apoyo y archivos capturables EN el alta (módulo Incidencias y expediente) — se asocian/suben al crear el registro | E2E completo (crear + persona + autoridad + elemento + archivo; detalle regresa todo) |
| RF-ARC-001..002 | Subida a MinIO, metadatos completos, SHA-256. QA 31/08: descripción POR ARCHIVO desde la captura integrada (`shared/archivos-captura.component` en ingresos/movimientos/audiencias/traslados/incidencias) y columna Descripción en el panel de archivos | E2E (hash local = hash servidor; `descripcion` persistida desde la captura) |
| RF-ARC-005..007 | Listado por entidad, URL presignada, desactivación bloquea | E2E |
| RF-CAT-001..007 | CRUD catálogos administrables, dedup normalizado, semillas completas (284 valores). QA 31/08: listados de administrables en orden natural (número inicial primero, `substring ^[0-9]+` en el `ORDER BY`) | E2E + UT (`normalizar`) |
| RF-CAT-008..009 | Fijos solo lectura; sin endpoint de edición | E2E + revisión |
| DP-010 | `PaginationQueryDto` en todos los listados | E2E |

Las anotaciones «QA 31/08» corresponden a la ronda de observaciones del equipo
(commit `705b82e`, verificación E2E 20/20); las decisiones tomadas en esa ronda
(teléfono a 10 dígitos, catálogo derivado de adscripciones) están registradas
en `docs/PLAN-RECLUSORIO.md` §4 «Ajustes de la ronda de QA».

## Pendientes que siguen requiriendo decisión del equipo

P1 obligatoriedad en esquema · P2 listados completos de centros/destinos/tipos de audiencia · P3 valores de Gender/MaritalStatus · P4 baja de personas · P5 bitácora de dominio · P6 política de archivos · P7 política de contraseñas completa · P8 framework del frontend (F10). Detalle en `docs/PLAN-RECLUSORIO.md`.
