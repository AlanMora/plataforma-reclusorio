# Separación en repositorios independientes (polyrepo)

Este monorepo puede separarse en **11 repositorios** manteniendo el mismo código,
para que puedas trabajar en un microservicio sin descargar los demás.

## Estructura resultante

| Repo | Qué es |
| --- | --- |
| `base-shared` | Núcleo compartido publicado como paquete **`@c5desarrollos/shared`** en GitHub Packages. |
| `base-gateway-service` … `base-realtime-service` (10) | Cada microservicio, autocontenido, que instala `@c5desarrollos/shared` como dependencia. |

El repo actual (`icms-platform`) queda como repo de **orquestación** (docker-compose,
Swarm, infra, docs).

## Cómo se hace

Todo está automatizado. Desde tu máquina (donde tu `gh`/git ya tiene acceso a la
organización), en un clon de este repo:

```bash
# genera y sube los 11 repos a la organización
ORG=C5Desarrollos ./tools/split-and-push.sh

# o solo generar en .split-out/ para revisar antes de subir
ORG=C5Desarrollos PUSH=0 ./tools/split-and-push.sh
```

El generador (`tools/split/generate.mjs`) reutiliza el código real de `libs/` y
`apps/`, reescribiendo los imports `@icms/*` a `@c5desarrollos/shared`.

## Después de subir (una sola vez)

1. **Publicar el núcleo compartido** (dispara el workflow de GitHub Packages):
   ```bash
   cd .split-out/base-shared
   git tag v1.0.0 && git push origin v1.0.0
   ```
2. **Token de instalación** (paquete privado) — local, CI y Docker:
   ```bash
   export NODE_AUTH_TOKEN=<PAT con scope read:packages>
   ```
   Cada servicio ya incluye un `.npmrc` que usa esa variable.
3. **Trabajar en un servicio**:
   ```bash
   pnpm install && pnpm start:dev
   ```

## Cómo consume cada servicio el núcleo

Import único desde el barrel (compatible con la resolución de módulos estándar):

```ts
import { JwtAuthGuard, ApiResponse, DatabaseModule, RedisModule } from '@c5desarrollos/shared';
```

## Verificación realizada

- `base-shared` compila como paquete standalone y se importa correctamente en runtime.
- `base-auth-service`, `base-gateway-service`, `base-file-service`, `base-realtime-service`
  y `base-scheduler-service` **compilan (typecheck) contra el paquete empaquetado**.

## Nota sobre actualizar el núcleo

Al cambiar `@c5desarrollos/shared`, publica una nueva versión (`npm version patch`
+ tag) y actualiza la dependencia en los servicios que la necesiten. Los servicios
que no la actualicen siguen con su versión fijada (aislamiento real).
