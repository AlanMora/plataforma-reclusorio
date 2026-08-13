# Plan de trabajo — Plataforma de Gestión de Reclusorio

**Fuentes de verdad:** `Especificacion_Requerimientos_Funcionales_Plataforma_Reclusorio.docx` (v1.0, 05/08/2026) y `Modelo_de_Datos_Consolidado_Plataforma_Reclusorio_final.docx`.
**Base técnica:** plataforma base reutilizable de microservicios (este monorepo).
**Mandato del documento:** no ampliar el esquema de dominio, trabajar por RF citando identificadores, validar en dos capas, sembrar catálogos completos, registrar decisiones pendientes sin asumirlas.

---

## 1. Mapeo dominio → arquitectura base

El modelo de datos es un **dominio cohesivo** (todas las tablas se relacionan por FK). Por integridad referencial vive completo en **un solo servicio de dominio con su propia BD**, renombrado desde la plantilla `core-domain-service`.

| Pieza del requerimiento | Servicio de la base | Trabajo |
|---|---|---|
| Personas, domicilios, elementos, ingresos/libertades, movimientos, audiencias, traslados, incidencias + 5 asociativas | **reclusorio-service** (renombra `core-domain-service`) | Implementar completo |
| Catálogos administrables (8) y fijos (9) | **reclusorio-service** (misma BD: las FKs lo exigen) | Implementar completo |
| Archivos (metadatos + exclusividad + SHA-256) | **reclusorio-service** (tabla `archivos` con FKs) + MinIO para binarios (patrón del file-service) | Implementar completo |
| Login, sesión 30 min renovable, cambio de contraseña, cuenta | **auth-service** | Ajustar TTLs + endpoint change-password + auditoría |
| Roles, permisos por módulo, reglas personalizadas (RF-SEG) | **configuration-service** (roles/permissions) + guards en cada endpoint | Ajustar/consumir |
| Revocación de sesión en tiempo real (RF-SES-009, DP-009) | **auth-service** publica evento → **realtime-service** empuja por WebSocket | Conectar |
| Notificaciones (bandeja, búsqueda, paginado, leída) | **notification-service** (persistencia propia del servicio, permitida por DP-001) | Extender |
| Entrada única, rate limit, pre-validación JWT | **gateway-service** | Ya listo |
| Reportes, exportaciones, tableros | — | **Fuera de alcance** (§2.2) |

Los patrones transversales ya resueltos por la base cubren directamente: UUID (RF-GEN-001), catálogos por referencia (RF-GEN-002/RF-CAT-010), validación en dos capas (RF-GEN-004), errores sin detalles internos RFC 9457 (RF-GEN-005), permisos en backend (RF-SEG-002), paginación server-side (DP-010), JWT (DP-002).

## 2. Decisiones técnicas fieles al documento

1. **Nombres exactos**: tablas y campos se crean con los nombres del modelo (`personas.idPersona`, `numeroExterior`…). No se renombran (instrucción §22.11).
2. **PK propias del modelo**: las entidades de dominio NO heredan la BaseEntity de la plataforma; usan su PK nombrada (`idPersona`) tal como el modelo define. Se agregan únicamente columnas técnicas de auditoría (`fechaRegistro`/`fechaActualizacion` donde el modelo ya las define; bitácora de quién-hizo-qué pendiente de modelo, línea "se registra quién realiza qué acción").
3. **Exclusividad de archivos** (RF-ARC-003): CHECK constraint en BD (exactamente 1 de las 6 FKs no nula) + validación en backend.
4. **Duplicados de catálogo** (RF-CAT-006): comparación normalizada (trim, lower, sin acentos — extensión `unaccent` de Postgres) con índice único funcional.
5. **Sesión 30 min** (RF-SES-002): TTL de sesión/refresh en Redis = 30 min renovables; el refresh rota y reinicia la vigencia. El aviso a 5 min es del frontend usando el tiempo restante expuesto en la cuenta (RF-CUE-001).
6. **Elementos**: búsqueda previa (`numeroElemento`, luego nombre+adscripción) con endpoint dedicado de coincidencias; alta condicionada (RF-ELE-001/002). PKs compuestas en asociativas impiden duplicados (RF-ELE-005).
7. **Semillas completas** (RF-CAT-007): seeds idempotentes con TODOS los valores del modelo, sin abreviar.
8. **Edad calculada** (RF-GEN-008): nunca se persiste; se expone calculada en las respuestas.

## 3. Fases (siguiendo la secuencia recomendada §23)

| Fase | Contenido | RFs cubiertos | Estimación* |
|---|---|---|---|
| **F0. Provisión** | Repo del proyecto desde la base, rename `core-domain → reclusorio`, `.env`, TTL 30 min | — | 0.5 d |
| **F1. Esquema + semillas** | 9 tablas + 5 asociativas + 17 catálogos, migración inicial, seeds completos (107 delitos, 16 centros, 19 juzgados, 26 juez_juzgados, 46 destinos, 26 tipos de audiencia, 14 tipos de incidencia, 5 autoridades, 9 fijos) | RF-GEN-*, RF-CAT-007 | 1.5 d |
| **F2. Catálogos** | CRUD administrables (alta, corrección, desactivar/reactivar, dedup normalizado), fijos solo lectura | RF-CAT-001…010 | 1.5 d |
| **F3. Personas + domicilios + elementos** | CRUD + búsqueda paginada (nombre, apellidos, alias, CURP), domicilios múltiples, padrón con búsqueda previa y alta condicionada | RF-PER-*, RF-ELE-* | 2.5 d |
| **F4. Actividades de persona** | Ingresos/libertades, movimientos, audiencias (+elementos), traslados (+elementos), coherencia próxima audiencia | RF-IEG-*, RF-MOV-*, RF-AUD-*, RF-TRA-* | 3 d |
| **F5. Incidencias** | Registro independiente + asociaciones con personas/autoridades/elementos + primer respondiente | RF-INC-* | 1.5 d |
| **F6. Archivos** | Carga a MinIO, SHA-256, metadatos, exclusividad, desactivación, descarga con permiso | RF-ARC-001…007 | 2 d |
| **F7. Seguridad y sesión** | Permisos por módulo/acción en todos los endpoints, cambio de contraseña, auditoría de sesión (con IP, DP-003), revocación en tiempo real vía WebSocket | RF-SEG-*, RF-AUT-*, RF-SES-*, RF-CUE-* | 2.5 d |
| **F8. Notificaciones** | Bandeja por usuario: listar, buscar, paginar, marcar leída | RF-NOT-001…004 | 1.5 d |
| **F9. Aceptación** | Pruebas e2e de CU-01…CU-07, matriz RF → código → prueba (instrucción §22.12) | §20 completo | 2 d |
| **F10. Frontend** | `apps/reclusorio-web` — **Angular 22 + Tailwind CSS 4** (decisión del equipo, 06/08/2026): login, layout privado, sidebar por permisos del JWT, aviso de expiración a 5 min, revocación en vivo (WebSocket), módulos de personas/actividades/elementos/incidencias/catálogos/notificaciones/cuenta; errores problem+json | RF-UI-*, RF-SES-* (lado cliente) | hecho |

\* Estimaciones de esfuerzo del agente por fase; cada fase termina con build + tests + push y matriz de RFs cubiertos.

## 4. Decisiones pendientes que el equipo debe confirmar

Registradas conforme al mandato §22.10 (no asumir silenciosamente):

| # | Tema | Detalle | Propuesta |
|---|---|---|---|
| P1 | **Obligatoriedad de campos de persona** | El modelo marca `primerNombre`, `curp`, `fechaNacimiento` como *opcionales*; DP-007 dice que deben ser *obligatorios* | Esquema fiel al modelo (nullable) + obligatoriedad en la validación del backend (DTO), reversible sin migración |
| P2 | **Conteos de catálogo inconsistentes** | El doc declara `centros (30)` pero lista 16; `destino_traslado (60)` lista 46; `tipo_audiencia (30)` lista 26 | Sembrar exactamente los valores listados y pedir el listado faltante |
| P3 | **Valores de ENUM Gender / MaritalStatus** | El modelo los declara ENUM sin definir valores | Pedir valores oficiales; mientras, VARCHAR con validación de lista configurable |
| P4 | **Baja de personas** (DP-005) | Sin campo de estado en `personas`; no debe inventarse | Bloquear la baja hasta aprobación; DP-005 sugiere borrado lógico — requiere aprobar el campo |
| P5 | **Modelo de bitácora de dominio** (§4 línea final y §17) | "Queda pendiente el modelo de bitácora" | Proponer tabla de auditoría técnica en BD del servicio (fuera del esquema de dominio) |
| P6 | **Política de archivos** (DP-006) | Tamaño máximo, MIME permitidos, antivirus, retención | Configurable por env; valores por confirmar |
| P7 | **Política de contraseñas** (DP-004) | Longitud, complejidad, historial, bloqueo | Mínimo 12 caracteres + verificación de contraseña actual (RF-CUE-002); resto por confirmar |
| P8 | **Framework del frontend** | La spec define comportamiento (RF-UI-*) pero no tecnología | **RESUELTA (06/08/2026): el equipo eligió Angular.** Implementado en F10 como `apps/reclusorio-web` (Angular 22 + Tailwind CSS 4, app del monorepo detrás del gateway) |
| P10 | **Validación inicial Confirmar/Descartar** | El modelo no define estado de revisión en registros operativos | **APROBADA (11/08/2026, indicación directa del equipo):** columna `estadoRevision` (PENDIENTE/CONFIRMADO/DESCARTADO) en `ingreso_egreso`, `movimientos`, `audiencias`, `traslados` e `incidencias`; endpoints `/:id/confirmar` y `/:id/descartar` aplicables UNA sola vez (los registros no se modifican después — la validación actúa como control inicial y el estado queda visible en la interfaz y persistido) |
| P11 | **Asistente de voz del mapa Penitenciarios** | §2.2 deja reportes/tableros fuera de alcance; el asistente requiere conteos de incidencias por centro | **APROBADA (13/08/2026, indicación directa del equipo):** asistente de voz en `/penitenciarios` — dictado y respuesta hablada con las APIs del navegador (Web Speech, es-MX; nada sale del sistema), intérprete de intenciones por reglas en el front (`asistente-intents.ts`, enchufable a LLM después) y endpoint de agregación `GET /incidencias/resumen-por-centro` (permiso `incidencias:consultar`, excluye DESCARTADOS de P10, sin tablas ni campos nuevos). Comandos: enfocar centro, población, incidencias por centro/periodo con capa en el mapa, resumen |
| P9 | **Coordenadas y catálogos de ubicación en domicilios y centros** | El Modelo de Datos v1.0 no define `latitud`/`longitud` ni catálogos de país/estado/municipio | **APROBADA (11/08/2026, indicación directa del equipo):** columnas `latitud`/`longitud` (double precision, nulas) en `domicilios` Y en `centros`, capturadas desde el mapa (Leaflet + geocodificación Nominatim/OSM). Los centros penitenciarios se ubican al editarlos en Catálogos y se visualizan en el módulo Penitenciarios (mapa general); coordenadas iniciales aproximadas sembradas por el seeder (solo cuando faltan). País/estado/municipio pasan a selects en el frontend con data dummy en `apps/reclusorio-web/src/app/core/ubicaciones-dummy.ts`, a reemplazar por seeders/catálogos reales cuando el equipo los entregue |

## 5. Definiciones ya resueltas por la base

- DP-001 (usuarios/roles/sesiones/notificaciones fuera del dominio) → microservicios auth/configuration/notification ✓
- DP-002 (JWT) → RS256 + JWKS ✓
- DP-003 (lugar = IP) → se registra IP en auditoría de sesión ✓
- DP-009 (canal en tiempo real) → realtime-service (socket.io + Redis) ✓
- DP-010 (paginación server-side) → PaginationQueryDto estándar ✓

## 6. Flujo de trabajo por fase (mandato §22)

Cada iteración: (1) citar los RF a resolver, (2) enumerar tablas/campos involucrados, (3) implementar backend + validaciones, (4) pruebas unitarias de reglas + integración de persistencia/autorización, (5) reportar matriz RF → archivos → pruebas ejecutadas. Sin migraciones que agreguen tablas/campos no aprobados.
