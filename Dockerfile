# syntax=docker/dockerfile:1
# =====================================================================
# Imagen de PRODUCCIÓN — multi-stage, parametrizada por servicio.
#   docker build -f Dockerfile --build-arg SERVICE=auth-service -t icms/auth-service .
# El build compila con Nx (webpack externaliza deps); el runtime instala SOLO
# las dependencias de producción listadas en el package.json generado.
# =====================================================================
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- Stage 1: build ----------
FROM ${NODE_IMAGE} AS build
ARG SERVICE
RUN corepack enable
WORKDIR /workspace

# Cachea la instalación de dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Compila el servicio solicitado.
COPY . .
RUN test -n "$SERVICE" || (echo "Falta --build-arg SERVICE=<servicio>" && exit 1)
# Se invoca el binario de nx directamente (más robusto y rápido que `pnpm exec`).
RUN ./node_modules/.bin/nx build "$SERVICE" --configuration=production

# ---------- Stage 2: runtime ----------
FROM ${NODE_IMAGE} AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app

# Copia solo el artefacto del servicio (main.js + package.json generado).
COPY --from=build /workspace/dist/apps/${SERVICE}/ ./

# Instala únicamente dependencias de producción y ajusta permisos.
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && chown -R node:node /app

USER node
CMD ["node", "main.js"]
