# ICMS Platform

Plataforma base **reutilizable** de microservicios construida con **NestJS + Nx**
(monorepo con pnpm workspaces). Este repositorio es el andamiaje que otros
proyectos clonan y adaptan: incluye el núcleo compartido (seguridad, logging,
mensajería, observabilidad), diez servicios ejecutables y la infraestructura
local en Docker.

> Estado: **andamiaje**. Cada servicio arranca, expone health/Swagger/metrics y
> deja la estructura de módulos con límites claros. La lógica de negocio profunda
> se completa por proyecto (marcada con `TODO(proyecto)`).

## Arquitectura

```
                    ┌───────────────────────────────────────────────┐
   Cliente ──HTTP──▶│  gateway-service  (único punto público :3000)  │
                    │  enruta · rate limit · JWT preliminar · CID    │
                    └───────┬───────────────────────────────────────┘
                            │ (proxy interno)
   ┌────────────┬───────────┼────────────┬─────────────┬───────────────┐
   ▼            ▼           ▼            ▼             ▼               ▼
 auth      configuration  core-domain  reporting   notification    integration
 :3001     :3002          :3003        :3004        :3005           :3006
   │            │           │            │             │               │
   ▼            ▼           ▼            ▼             ▼               ▼
 file        scheduler    realtime   ── eventos de dominio (RabbitMQ) ──
 :3007       :3008        :3009
```

### Servicios

| Servicio                | Puerto | Responsabilidad                                                      |
| ----------------------- | ------ | ------------------------------------------------------------------- |
| `gateway-service`       | 3000   | Único punto público: enruta, rate limiting, JWT preliminar, CID, normaliza errores. Sin lógica de negocio. |
| `auth-service`          | 3001   | Identidad, login, JWT, refresh, sesiones, revocación, recuperación, 2FA, auditoría. |
| `configuration-service` | 3002   | Organización (instituciones/sucursales/usuarios operativos), permisos (roles), catálogos/parámetros/flags. |
| `core-domain-service`   | 3003   | **Plantilla** del negocio (renómbrala por proyecto). Entidades, reglas, flujos, eventos. |
| `reporting-service`     | 3004   | Consultas pesadas y documentos (CSV/Excel/PDF). Consume la **réplica de lectura**. |
| `notification-service`  | 3005   | Email/SMS/push/internas, plantillas, reintentos, historial. Consume eventos. |
| `integration-service`   | 3006   | Sistemas externos: webhooks, transformación, outbox, reintentos, conciliación. |
| `file-service`          | 3007   | Archivos en MinIO/S3, metadatos, versiones, antivirus, URLs temporales. |
| `scheduler-service`     | 3008   | Cron distribuido con lock Redis (exclusión mutua), historial, reintentos. |
| `realtime-service`      | 3009   | WebSocket (socket.io) con adaptador Redis para escalado horizontal.  |

### Librerías compartidas (`libs/`)

| Lib                 | Contenido                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| `@icms/common`      | Sobre de respuesta uniforme, filtro global de errores, DTOs base, bootstrap. |
| `@icms/config`      | Carga tipada de env + feature flags.                                      |
| `@icms/logging`     | Logger pino estructurado + middleware `correlationId`.                    |
| `@icms/auth`        | `JwtStrategy`, guards (roles/permisos), decoradores `@CurrentUser`/`@Roles`. |
| `@icms/database`    | TypeORM con **replicación** primary/replica + entidad base (soft-delete). |
| `@icms/messaging`   | RabbitMQ (exchange topic + DLX) + `EventPublisher`.                        |
| `@icms/observability` | Health checks (Terminus) + métricas Prometheus (`/metrics`).            |
| `@icms/contracts`   | Contratos de eventos de dominio compartidos.                              |

### Infraestructura (`infra/docker-compose.yml`)

`postgres-primary` + `postgres-replica` (streaming) · `redis` · `rabbitmq`
(UI :15672) · `minio` (:9000, consola :9001) · `prometheus` (:9090) ·
`grafana` (:3200) · `loki` + `promtail`.

## Puesta en marcha

Hay **dos formas** de ejecutar la plataforma. Elige una:

### Opción A — Todo en Docker

Un solo comando levanta infraestructura **y** servicios. No requiere Node/pnpm local.

```bash
# Desarrollo (hot-reload: editas en tu editor y el contenedor recompila solo)
pnpm docker:dev          # docker compose -f docker-compose.dev.yml up --build
# …o un subconjunto:
docker compose -f docker-compose.dev.yml up gateway-service auth-service

# Producción (imágenes compiladas y esbeltas por servicio)
cp .env.docker.example .env.docker      # define tus secretos
pnpm docker:prod:build                  # construye las 10 imágenes
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d
```

En ambos modos los puertos `3000–3009` quedan publicados en tu host, igual que abajo.

### Opción B — Infra en Docker + servicios en el host (ciclo de desarrollo más ligero)

Requisitos: Node ≥ 20, pnpm, Docker.

```bash
# 1) Dependencias
pnpm install

# 2) Configuración
cp .env.example .env

# 3) Solo la infraestructura (Postgres, Redis, RabbitMQ, MinIO, observabilidad)
pnpm infra:up

# 4) Servicios (todos, o uno concreto) — corren en tu máquina
pnpm serve                       # nx run-many -t serve
npx nx serve auth-service        # un servicio

# Build / lint de todo el monorepo
pnpm build
pnpm lint
```

> **¿Cuál usar?** *Opción A (dev)* si quieres todo containerizado sin instalar nada;
> *Opción B* para el ciclo de edición más rápido y depuración directa. *Opción A (prod)*
> es la que se despliega. Nota: en dev-Docker corren 10 watchers de webpack, así que
> consume RAM — levanta solo los servicios que necesites.

### Endpoints comunes (en cada servicio)

- `GET /health` · `GET /health/ready` — liveness / readiness
- `GET /metrics` — métricas Prometheus
- `GET /api/docs` — Swagger (excepto realtime)

Las rutas de negocio se versionan bajo `/api/v1/...` y se acceden **a través del
gateway** (p. ej. `POST http://localhost:3000/api/v1/auth/login`).

## Convenciones

- **database-per-service**: cada servicio con estado usa su propia BD (`icms_*`).
- **Eventos de dominio** vía RabbitMQ (`@icms/messaging`), routing keys en `@icms/contracts`.
- **CorrelationId** (`x-correlation-id`) se propaga desde el gateway y aparece en todos los logs.
- **Errores** normalizados al sobre `ApiResponse` en toda la plataforma.

## Renombrar la plantilla de dominio

`core-domain-service` es una plantilla. Para tu proyecto:

```bash
pnpm rename:core loans-service   # renombra app, configs y referencias
```

Revisa el diff, ajusta el nombre de la BD (`icms_core`) si aplica y reconstruye.

## Estructura del repositorio

```
apps/                     # 10 microservicios NestJS
libs/                     # núcleo compartido (@icms/*)
infra/                    # docker-compose de infraestructura + configs
tools/                    # utilidades (rename de la plantilla)
Dockerfile                # imagen de producción (multi-stage, parametrizada)
Dockerfile.dev            # imagen de desarrollo (hot-reload)
docker-compose.dev.yml    # dev: infra + 10 servicios con recarga en caliente
docker-compose.prod.yml   # prod: infra + 10 imágenes compiladas
```
