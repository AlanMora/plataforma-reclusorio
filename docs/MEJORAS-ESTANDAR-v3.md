# Mejoras aplicadas para alinear con el Estándar de Arquitectura v3

> Documento para el equipo. Resume las mejoras incorporadas al andamiaje base a
> partir del análisis del documento **"Arquitectura Base Reutilizable v3"**, con
> la sección del estándar que las motiva y una nota de verificación.

Decisión base: se mantiene **monorepo** (Nx + pnpm). El estándar lo avala
explícitamente (§1.4, §22, Anexo A: *"la separación prematura no es una mejora"*).
Las fronteras, contratos y ownership de datos se respetan **dentro** del monorepo.

---

## 1. Mejoras implementadas y verificadas

| # | Mejora | Estándar | Qué se hizo | Verificación |
|---|--------|----------|-------------|--------------|
| 1 | **Contraseñas con Argon2id** | §4.2 | Se reemplazó bcrypt por `@node-rs/argon2` (argon2id). Comparación en tiempo constante para usuarios inexistentes. | Hash `$argon2id$...` en BD; login OK/401 probado. |
| 2 | **JWT asimétrico RS256 + JWKS** | §4.2, §6.1 | `auth-service` firma access tokens RS256 y publica `GET /.well-known/jwks.json`. Validación dual compartida (RS256 vía JWKS si `JWKS_URI`, si no HS256). Gateway y servicios validan por JWKS. | Loop entre servicios probado: token `alg:RS256+kid`, core valida vía JWKS de auth; token inválido → 401. |
| 3 | **Sesiones y refresh en Redis + rotación** | §4.2, §5.2 | Store de sesiones en Redis (revocación instantánea, TTL). Refresh con `jti` único, hash SHA‑256, **rotación con detección de reuso** (revoca la sesión ante reuso). | Probado: refresh rota; reuso del token viejo → 401 + sesión revocada. |
| 4 | **Errores RFC 9457 (`application/problem+json`)** | §7.4 | Filtro global emite `problem+json` (`type,title,status,detail,instance,correlationId,code`). | Content‑Type y cuerpo verificados en auth y core. |
| 5 | **Multi‑tenancy: contexto + claims + auditoría** | §6.2, §14, §19 | `BaseEntity` con `tenantId`, `organizationalUnitId`, `createdBy`, `updatedBy`. JWT/usuario con `ous[]` y `scope` (`own_ou/assigned_ous/all_ous`). Contexto por petición con `AsyncLocalStorage`. | Probado: `tenantId`/`createdBy` derivados del JWT y persistidos. |
| 6 | **UUID v7 + timestamps UTC + soft‑delete + versión** | §19 | `BaseEntity` genera id **UUID v7** (ordenable por tiempo); `createdAt/updatedAt` UTC, `deletedAt`, `version`. | id `019f...` (v7) verificado en BD. |
| 7 | **Idempotencia (`Idempotency-Key`)** | §7.1, §12.2 | `@Idempotent()` + interceptor respaldado en Redis: replay de la respuesta original; `409` si falta la cabecera. | Probado: replay con misma clave = misma respuesta; sin clave → 409. |
| 8 | **Outbox / Inbox** | §5.3, §7.1 | `OutboxService` (encola el evento en la MISMA transacción), `OutboxRelay` (publica con `FOR UPDATE SKIP LOCKED`), `InboxService` (dedup por `eventId+consumer`). | Probado: evento `example.created` en outbox pasa a `published` por el relay. |
| 9 | **Contrato de evento estándar** | §7.2 | `DomainEvent` con `eventType` (`Nombre.vN`), `producer`, `causationId`, `aggregateId`, `traceId`, `schemaVersion`. | Compila y se publica con el nuevo contrato. |
| 10 | **Rate limiting global en Redis** | §5.2, §10 | `@nestjs/throttler` con storage Redis: límite compartido entre réplicas del gateway. | Cableado y build verificado. |
| 11 | **Migraciones (sin `synchronize` en prod)** | §5.1 | `DatabaseModule` soporta `migrations` + `migrationsRun` en producción; `synchronize` solo en desarrollo. | Config verificada; build OK. |
| 12 | **OpenTelemetry (trazas)** | §8.3 | `initTracing()` opt‑in (por `OTEL_EXPORTER_OTLP_ENDPOINT`, import dinámico) cableado en `core-domain-service`. | Build OK; no‑op sin colector. Ver nota abajo. |
| 13 | **Semilla de pruebas** | §9 | Jest configurado; pruebas unitarias en `common` y `config`. | `nx run-many -t test` en verde. |
| 14 | **`core-domain-service` como implementación de referencia** | §12.4, §20 | Integra outbox transaccional + idempotencia + contexto de tenant como plantilla a replicar en los demás servicios. | Flujo completo probado end‑to‑end. |

Verificación transversal: **`nx run-many -t build` (10/10)**, **`pnpm lint` limpio**,
pruebas en verde, y pruebas de integración con Postgres + Redis + RabbitMQ reales.

---

## 2. Mejoras que sugerí AL DOCUMENTO (para discutir)

Son afinamientos; el estándar ya es sólido.

1. **Autorización en el JWT (§14/§6):** el token lleva `tenant + ous + scope`, pero
   conviene fijar que la **autorización fina** se resuelve en el dominio contra una
   **proyección de permisos cacheada** (invalidada por `RolePermissionsChanged.v1`),
   con access token corto para acotar la ventana de permisos "viejos".
2. **Revocación de access tokens:** hacer explícita la estrategia (TTL corto +
   revocación de sesión en Redis para logout/step‑up).
3. **Refresh por familia:** definir límites (máx. tokens por familia, TTL de familia).
4. **Trazas:** nombrar el mecanismo de propagación (`traceparent` W3C) en §8.
5. **Contrato de evento:** añadir `schemaVersion` explícito (ya lo incorporamos en código).

---

## 3. Pendiente / roadmap (no bloquea el arranque)

- **OpenTelemetry con el bundle de webpack:** la instrumentación automática requiere
  cargarse antes que los módulos. Para cobertura total conviene un preload
  (`NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"`) o
  ejecutar sin bundle. Hoy queda **cableado y opt‑in**; falta validar trazas contra
  un colector (Tempo/Jaeger).
- **Migraciones por servicio:** el soporte está en `DatabaseModule`; falta generar
  los archivos de migración por servicio y un `data-source.ts` para el CLI.
- **Cobertura de pruebas:** hay semilla; falta subir cobertura (integración,
  contratos consumidor‑proveedor, autorización por recurso, resiliencia — §9).
- **Contratos AsyncAPI + validación en CI** (§3.2, §7.3): hoy hay OpenAPI (Swagger).
- **Modelo organizacional completo** (§14): `ous`/`scope` ya están en el token y el
  contexto; falta el CRUD de OUs y la resolución de alcance en `configuration-service`.
- **Seguridad operacional** (§6.3): gestor de secretos, mTLS, SBOM/firma de imágenes,
  SAST en el pipeline.
- **Aplicar el patrón de `core-domain` a los demás servicios** (outbox/idempotencia
  donde aplique).

---

## 4. Variables de entorno nuevas

| Variable | Para qué |
|----------|----------|
| `JWKS_URI` | URL de JWKS de auth; activa validación RS256 en todos los servicios. |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | Par RSA (PEM) para firmar/verificar en producción. |
| `SERVICE_NAME` | Nombre del servicio productor en los eventos de dominio. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Colector OTLP; activa las trazas. |
| `PROBLEM_TYPE_BASE` | URI base para el campo `type` de los errores problem+json. |
