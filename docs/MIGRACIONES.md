# Migraciones (TypeORM)

Cada servicio con base de datos tiene su propio `data-source.ts` y sus migraciones
en `apps/<servicio>/src/migrations/`.

- **Desarrollo**: `DatabaseModule` usa `synchronize` (crea el esquema solo) — rápido.
- **Producción**: `synchronize` está apagado; las migraciones se aplican con la
  **CLI en el pipeline**, antes de desplegar (no al arrancar la app, porque el
  bundle de webpack no incluye los archivos de migración).

## Comandos

```bash
# Generar una migración a partir del diff entidades ↔ BD (BD vacía o al día)
POSTGRES_DB=icms_auth pnpm migration:generate apps/auth-service/src/migrations/<Nombre> \
  -d apps/auth-service/src/data-source.ts

# Aplicar migraciones pendientes
POSTGRES_DB=icms_auth pnpm migration:run    -d apps/auth-service/src/data-source.ts

# Revertir la última
POSTGRES_DB=icms_auth pnpm migration:revert -d apps/auth-service/src/data-source.ts
```

Cambia `POSTGRES_DB` y la ruta del `data-source` según el servicio
(`icms_configuration`, `icms_core`, `icms_notification`, `icms_integration`,
`icms_files`, `icms_scheduler`).

## Estado

Migración inicial (`Init`) **generada y verificada** para los 7 servicios con BD.
La de `auth` se **aplicó** en una BD limpia (crea `users`, `security_audit_logs`,
`outbox_events`, `inbox_events`). En el pipeline, corre `migration:run` por servicio
antes de cada despliegue.

> Nota: `data-source.ts` carga entidades por glob. Para servicios cuyas entidades
> viven en archivos `.module.ts` (p.ej. `configuration`), el glob abarca todo
> `src/app/**/*.ts`; conviene, a futuro, mover las entidades a archivos `*.entity.ts`.
