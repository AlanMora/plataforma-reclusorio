# syntax=docker/dockerfile:1
# =====================================================================
# Imagen de PRODUCCIÓN del frontend — build Angular + nginx con TLS.
#   docker build -f apps/reclusorio-web/Dockerfile -t icms/reclusorio-web .
# (contexto = raíz del monorepo: necesita pnpm-lock.yaml y libs de Nx)
#
# El nginx cumple en producción el papel del proxy.conf.json de dev:
#   /api        → gateway-service:3000
#   /socket.io  → realtime-service:3009 (WebSocket)
#   resto       → estáticos Angular con fallback a index.html
# Si no se monta un certificado, genera uno autofirmado al arrancar
# (ver nginx/40-cert-autofirmado.sh).
# =====================================================================
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- Stage 1: build Angular ----------
FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /workspace

# Cachea la instalación: manifests del workspace + lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/reclusorio-web/package.json apps/reclusorio-web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN ./node_modules/.bin/nx build reclusorio-web --configuration=production

# ---------- Stage 2: nginx ----------
FROM nginx:1.27-alpine AS runtime

# openssl para el certificado autofirmado de respaldo.
RUN apk add --no-cache openssl

COPY apps/reclusorio-web/nginx/default.conf /etc/nginx/conf.d/default.conf
# El entrypoint oficial de nginx ejecuta los scripts de /docker-entrypoint.d.
COPY --chmod=755 apps/reclusorio-web/nginx/40-cert-autofirmado.sh /docker-entrypoint.d/

COPY --from=build /workspace/apps/reclusorio-web/dist/reclusorio-web/browser/ /usr/share/nginx/html/

EXPOSE 80 443
