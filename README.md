# Sistema de Control Penitenciario

Sistema penitenciario construido sobre la plataforma base **ICMS** de
microservicios (**NestJS + Nx**, monorepo pnpm) con frontend **Angular 22 +
Tailwind CSS 4**. Backend F0–F9 completo y verificado E2E; frontend F10
implementado (RF-UI, sesión de 30 min, revocación en tiempo real).

Fuentes de verdad del dominio: la **Especificación de Requerimientos
Funcionales v1.0** y el **Modelo de Datos Consolidado** del equipo. Plan y
trazabilidad: [`docs/PLAN-RECLUSORIO.md`](docs/PLAN-RECLUSORIO.md) y
[`docs/MATRIZ-RF-RECLUSORIO.md`](docs/MATRIZ-RF-RECLUSORIO.md).

## Arranque rápido (proyecto completo)

Requisitos: Docker Desktop (≥ 8 GB si levantas todo), Node ≥ 20, pnpm.

```bash
# 0) Dependencias y configuración
pnpm install
cp .env.example .env

# 1) BACKEND — infra + los 5 servicios que usa el reclusorio
docker compose -f docker-compose.dev.yml up -d \
  postgres-primary postgres-replica redis rabbitmq minio \
  auth-service gateway-service reclusorio-service \
  notification-service realtime-service

#    Espera a que respondan (la primera vez compilan dentro del contenedor):
#    curl localhost:3000/health  localhost:3001/health  localhost:3010/health
#    En el primer arranque crea la BD del dominio si no existe:
#    docker exec -e PGPASSWORD=icms icms-postgres-primary \
#      psql -U icms -d icms -c "CREATE DATABASE reclusorio OWNER icms;"
#    (esquema y las 284 semillas de catálogo se generan solos al arrancar)

# 2) FRONTEND — proyecto Angular CLI independiente
cd apps/reclusorio-web
pnpm start                 # ng serve → http://localhost:4200
```

El dev server del front ya trae proxy (`proxy.conf.json`): `/api` → gateway
(:3000) y `/socket.io` → realtime (:3009). No hay que configurar nada más.

### Superusuario (sembrado automáticamente)

El acceso es con **nombre de usuario** y contraseña (no con correo). Con
`SEED_ADMIN_ENABLED=true` (ya viene en `docker-compose.dev.yml` y en
`.env.example`), el auth-service crea/actualiza al arrancar el
**superusuario** (rol `superadmin`) con los **27 permisos**:

```
usuario:    admin
contraseña: Reclusorio#Dev2026
```

El superusuario es la cuenta de rescate: restablece contraseñas olvidadas
desde `/usuarios`, no se puede desactivar ni perder los permisos de
administración, y solo otro superusuario puede modificarlo. Si él mismo
olvida su contraseña, arrancar una vez el auth-service con
`SEED_ADMIN_RESET_PASSWORD=true` la regresa a `SEED_ADMIN_PASSWORD`.

Todo usuario creado desde `/usuarios` (o al que se le restablece la
contraseña) recibe una **contraseña temporal**: al ingresar se le lleva a
`/cambiar-password` y el backend responde `403 PASSWORD_CHANGE_REQUIRED` a
cualquier otra ruta hasta que la cambie.

Entra en **http://localhost:4200**. El menú lateral se construye con los
permisos del JWT: si quitas un permiso, el módulo desaparece (RF-SEG-001).
Los demás usuarios se crean desde el módulo `/usuarios` (`POST
/api/v1/users`, requiere `users:write`). El registro público
`/api/v1/auth/register` fue eliminado. En producción, `Reclusorio#Dev2026`
jamás: el superusuario se siembra con una contraseña fuerte propia.

### Comandos útiles

```bash
pnpm docker:dev                      # TODO en Docker (11 servicios, pesado)
pnpm infra:up && pnpm serve          # alternativa: infra Docker + servicios en host
npx nx build reclusorio-web          # build de producción del front
npx nx build|test <servicio>         # por servicio; pnpm lint para todo
pnpm migration:generate -d apps/reclusorio-service/src/data-source.ts src/migrations/X
```

> Servicios en host (opción híbrida): exporta
> `JWKS_URI=http://localhost:3001/.well-known/jwks.json` o los tokens RS256
> se rechazan (en Docker ya viene en el compose).

## Despliegue a producción (Docker Swarm)

Un solo comando en el servidor (requiere Docker con Swarm; lo inicializa solo
si hace falta):

```bash
git clone <repo> && cd plataforma-reclusorio
./scripts/deploy-swarm.sh
```

La primera corrida crea `.env` desde `.env.docker.example` y se detiene para
que **cambies los secretos** (`JWT_SECRET`, `POSTGRES_PASSWORD`,
`RABBITMQ_PASSWORD`, `S3_ACCESS_KEY/SECRET_KEY`); la segunda construye las
imágenes (5 servicios + frontend) y despliega el stack `reclusorio`.

Qué queda corriendo:

- **`reclusorio-web`** (nginx) — ÚNICO servicio expuesto (80→443). Sirve la
  SPA Angular y proxyea `/api` → gateway y `/socket.io` → realtime dentro de
  la red overlay (mismo contrato que `proxy.conf.json` en dev). TLS con
  certificado **autofirmado autogenerado** (sin dominio no hay Let's Encrypt);
  con dominio/certificado real basta montarlo en `/etc/nginx/certs`.
- Los 5 servicios del reclusorio + postgres (primario y réplica), Redis,
  RabbitMQ y MinIO, sin puertos publicados al exterior.
- Las BD (incluida `reclusorio`) se crean solas al inicializar postgres
  (`infra/postgres/initdb`, entregado como `config` de Swarm); esquema y
  semillas de catálogo se generan al arrancar el servicio.

Primer despliegue: sembrar el superusuario (`SEED_ADMIN_ENABLED=true`,
`SEED_ADMIN_USERNAME` y una `SEED_ADMIN_PASSWORD` fuerte, nunca la de
desarrollo) y crear al resto desde el módulo `/usuarios`. Ya no existe el
registro público `POST /api/v1/auth/register`. Operación diaria: `docker stack ps reclusorio`,
`docker service logs reclusorio_<servicio>`; re-desplegar = volver a correr el
script (Swarm actualiza sin downtime con `order: start-first`).

### Trazabilidad: quién hizo qué

- **Bitácora del dominio** (`GET /api/v1/bitacora`): cada alta, modificación,
  confirmación/descarte o asociación quitada queda con usuario, fecha, IP,
  `correlationId` y los valores antes/después. Filtros: `entidad`,
  `idRegistro`, `idUsuario`, `accion`, `desde`, `hasta`.
- **Auditoría de seguridad** (`GET /api/v1/audit`): logins, sesiones,
  contraseñas y administración de usuarios.
- Ambas requieren el permiso `auditoria:consultar` (módulo "Auditoría y
  bitácora" en `/usuarios`).
- **Logs de peticiones**: cada línea JSON trae `userId`, `username` y
  `correlationId`. En Swarm, Promtail los manda a Loki (retención
  `LOKI_RETENTION`, 90 días por defecto) y se consultan en
  **https://<servidor>/grafana/** (usuario `GRAFANA_ADMIN_USER`, contraseña
  `GRAFANA_ADMIN_PASSWORD` del `.env`), dashboard **Trazabilidad**: filtros
  por servicio, usuario, correlation ID y ruta. Con el `correlationId` que
  devuelve cualquier respuesta o error se sigue una petición por todos los
  servicios.

> Alternativa sin Swarm: `docker compose -f docker-compose.prod.yml up -d`
> levanta lo mismo (más los servicios base de la plataforma) en un solo host.

## Arquitectura

```
 Navegador ──▶ reclusorio-web (:4200, Angular 22)
                 │  /api (proxy)                 │ /socket.io (proxy)
                 ▼                               ▼
        gateway-service (:3000)          realtime-service (:3009)
        único punto público HTTP         WebSocket: session.revoked
                 │
   ┌─────────────┼──────────────────┐
   ▼             ▼                  ▼
 auth (:3001)  reclusorio (:3010)  notification (:3005)
 sesiones 30m  TODO el dominio     bandeja del usuario
 Redis+JWKS    BD `reclusorio`     BD `icms_notification`
```

| Pieza | Puerto | Responsabilidad |
| --- | --- | --- |
| `apps/reclusorio-web` | 4200 | Frontend Angular 22 + Tailwind 4 (proyecto Angular CLI completo, estilo `ng new`): login, layout privado, sidebar por permisos, aviso de expiración a 5 min, módulos de personas/actividades/elementos/incidencias/catálogos/notificaciones/cuenta. |
| `gateway-service` | 3000 | Única entrada pública: enruta (incluye los prefijos del dominio → :3010), rate limit, JWT preliminar, correlationId. |
| `auth-service` | 3001 | Login (argon2id), JWT RS256 + JWKS, sesión/refresh de 30 min renovables en Redis con rotación, cambio de contraseña, auditoría con IP. |
| `reclusorio-service` | 3010 | TODO el dominio (BD `reclusorio`): personas, domicilios, elementos, ingresos/libertades, movimientos, audiencias, traslados, incidencias, archivos (MinIO + SHA-256 + exclusividad), 17 catálogos con semillas completas. |
| `notification-service` | 3005 | Bandeja `user_notifications`: listar, buscar, paginar, marcar leída. |
| `realtime-service` | 3009 | WebSocket (socket.io): consume `session.revoked` y lo emite a la sala `user:{id}` — el front cierra la sesión al instante (RF-SES-009). |
| resto (`configuration`, `core-domain`, `reporting`, `integration`, `file`, `scheduler`) | 3002–3008 | Servicios de la plataforma base; no participan en el flujo del reclusorio hoy. |

Librerías compartidas en `libs/` (`@icms/*`): errores RFC 9457
(`application/problem+json`), guards de permisos, TypeORM con réplica,
mensajería RabbitMQ (outbox/inbox), idempotencia, paginación estándar.
Swagger de cada servicio en `/api/docs`; rutas de negocio bajo `/api/v1/...`.

## Convenciones del proyecto

- Validación en dos capas; **el backend es la autoridad** (RF-GEN-004).
- Catálogos por UUID, nunca texto; usados → desactivar, jamás borrar.
- `edad` SIEMPRE calculada, nunca persistida (RF-GEN-008).
- Archivos: exactamente UNA referencia de entidad (CHECK + backend, RF-ARC-003).
- Dedup de catálogos ignora espacios/mayúsculas/acentos (RF-CAT-006).
- Permisos `modulo:accion` en claims del JWT; cada endpoint usa
  `@RequirePermissions(...)`; el front solo decide qué MOSTRAR.
- Commits en español con prefijo de fase; verificar E2E antes de push.
- Decisiones pendientes del equipo (P1–P7): ver
  [`docs/PLAN-RECLUSORIO.md`](docs/PLAN-RECLUSORIO.md) §4 — no se asumen.

## Estructura del repositorio

```
apps/
  reclusorio-web/         # frontend Angular 22 (angular.json + package.json propios)
  reclusorio-service/     # dominio completo del reclusorio (NestJS)
  gateway-service/        # entrada pública
  auth-service/           # identidad y sesión de 30 min
  notification-service/   # bandeja de notificaciones
  realtime-service/       # WebSocket de revocación
  ...                     # resto de la plataforma base (3002–3008)
libs/                     # núcleo compartido (@icms/*)
infra/                    # docker-compose de infraestructura
docs/                     # PLAN-RECLUSORIO.md · MATRIZ-RF-RECLUSORIO.md · guías
docker-compose.dev.yml    # dev: infra + servicios con hot-reload
docker-compose.prod.yml   # prod: imágenes compiladas
CLAUDE.md                 # contexto del proyecto para nuevas sesiones
```
