# Plataforma de Gestión de Reclusorio

Monorepo Nx + pnpm con 11 microservicios NestJS. Es un proyecto REAL construido
sobre una plataforma base reutilizable; el dominio vive en `apps/reclusorio-service`.

## Fuentes de verdad (NO desviarse de ellas)

1. **Especificación de Requerimientos Funcionales v1.0** y **Modelo de Datos
   Consolidado** (documentos Word del equipo). Regla dura: NO agregar tablas,
   campos ni valores de catálogo de dominio no aprobados; nombres de tablas y
   columnas EXACTOS al modelo (camelCase: `idPersona`, `primerNombre`...).
2. `docs/PLAN-RECLUSORIO.md` — plan de fases y decisiones técnicas.
3. `docs/MATRIZ-RF-RECLUSORIO.md` — trazabilidad RF → código → verificación.
4. Ante contradicción o vacío: registrar la decisión pendiente, NO asumir.

## Estado actual (backend COMPLETO, verificado E2E)

- **F0–F9 terminadas**: esquema completo (33 tablas, 284 valores de catálogo
  sembrados), catálogos administrables/fijos, personas + domicilios + padrón de
  elementos, actividades (ingresos/movimientos/audiencias/traslados),
  incidencias, archivos (MinIO + SHA-256 + exclusividad), sesión de 30 min con
  revocación en tiempo real (WebSocket), bandeja de notificaciones, matriz RF.
- **F10 frontend hecho**: `apps/reclusorio-web` — **Angular 22 + Tailwind CSS 4**
  (P8 resuelta por el equipo). Login, layout privado, sidebar por permisos del
  JWT, aviso de expiración a 5 min con extensión, logout forzado por WebSocket
  (`session.revoked`), módulos personas/actividades/elementos/incidencias/
  catálogos/notificaciones/cuenta, errores problem+json. Proyecto Angular CLI
  completo (angular.json + package.json propios, estilo `ng new`): levantar con
  `pnpm --filter reclusorio-web start` o `cd apps/reclusorio-web && pnpm start`
  (:4200, proxy `/api`→gateway :3000 y `/socket.io`→:3009).
- **Pendientes P1–P7** (decisiones del equipo, ver PLAN): listados faltantes de
  3 catálogos, valores ENUM Gender/MaritalStatus, baja de personas, bitácora de
  dominio, políticas de archivos y contraseñas.

## Arquitectura (lo esencial)

- `apps/reclusorio-service` (:3010, BD `reclusorio`) — TODO el dominio.
- `apps/auth-service` (:3001, BD `icms_auth`) — login/refresh/sesiones Redis/
  auditoría/JWKS. Access token RS256 10m; sesión/refresh 30m (RF-SES-002).
- `apps/notification-service` (:3005) — bandeja `user_notifications`.
- `apps/realtime-service` (:3009) — WebSocket; consume `session.revoked` y
  emite a la sala `user:{id}` (RF-SES-009).
- `apps/gateway-service` (:3000) — única entrada pública; enruta también los
  prefijos del dominio (`/api/v1/personas|catalogos|elementos|incidencias|
  archivos|audiencias|traslados|ingresos-egresos|movimientos` → :3010).
- `apps/reclusorio-web` (:4200) — frontend Angular 22 + Tailwind 4; consume
  SOLO el gateway (HTTP) y el realtime (WebSocket).
- Libs compartidas en `libs/` (@icms/*): errores RFC 9457, guards, outbox/inbox,
  idempotencia, paginación. Swagger por servicio en `/api/docs`; rutas `/api/v1`.
- Permisos: claims `permissions` en el JWT (`modulo:accion`, p.ej.
  `personas:crear`); cada endpoint usa `@RequirePermissions(...)`. Otorgar hoy:
  `UPDATE users SET permissions='...'` en `icms_auth` (cableado roles→permisos
  vía configuration-service aún no implementado).

## Comandos

```bash
pnpm docker:dev            # infra + servicios (hot-reload) — Docker Desktop ≥8GB
pnpm infra:up && pnpm serve  # alternativa: infra en docker, servicios en host
npx nx build|test <svc>    # por servicio; pnpm lint para todo
pnpm migration:generate -d apps/reclusorio-service/src/data-source.ts src/migrations/X
```

Al correr servicios en host: exportar `JWKS_URI=http://localhost:3001/.well-known/jwks.json`
(sin él, los tokens RS256 se rechazan — en Docker ya viene en el compose).

## Convenciones del proyecto

- Validación en dos capas; el backend es la autoridad (RF-GEN-004).
- Catálogos por UUID, nunca texto; usados → desactivar, jamás borrar.
- `edad` SIEMPRE calculada, nunca persistida. Sin baja de personas (P4 bloqueado).
- Dedup de catálogos ignora espacios/mayúsculas/acentos (fn `normalizar`).
- Archivos: exactamente UNA referencia de entidad (CHECK + backend).
- Commits en español con prefijo de fase; verificar E2E antes de push.
