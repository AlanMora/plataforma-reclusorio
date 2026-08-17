#!/usr/bin/env bash
# =====================================================================
# Despliegue a producción en Docker Swarm — un solo comando:
#   ./scripts/deploy-swarm.sh
# Hace: valida .env → construye imágenes → (init swarm si hace falta)
#       → docker stack deploy. Idempotente: correrlo de nuevo actualiza.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# ---- 1. Configuración ------------------------------------------------
if [[ ! -f .env ]]; then
  cp .env.docker.example .env
  echo "⚠️  No había .env: lo creé desde .env.docker.example."
  echo "    EDITA los secretos (JWT_SECRET, POSTGRES_PASSWORD, RABBITMQ_PASSWORD,"
  echo "    S3_ACCESS_KEY/S3_SECRET_KEY) y vuelve a correr este script."
  exit 1
fi

if grep -qE 'change-me-in-production|cambia-esto-por-un-secreto-fuerte|cambia-esta-contrasena' .env; then
  echo "❌ .env todavía tiene secretos de ejemplo (cambia-esta-contrasena / JWT_SECRET de muestra)."
  echo "   Cambia TODOS los valores marcados antes de desplegar."
  exit 1
fi

# stack deploy sustituye variables desde el entorno del shell, no lee .env.
set -a; source .env; set +a

# ---- 2. Imágenes -----------------------------------------------------
# Se etiquetan con el SHA de git: si el tag no cambia, Swarm considera el
# servicio "sin cambios" y NO reinicia los contenedores con la imagen nueva.
IMAGE_TAG="$(git rev-parse --short HEAD)"
export IMAGE_TAG
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  Hay cambios sin commit: el tag $IMAGE_TAG no los distingue."
  echo "    Si redepliegas sin commitear, fuerza con: docker service update --force reclusorio_<servicio>"
fi

echo "🔨 Construyendo imágenes (5 servicios + frontend) [tag: $IMAGE_TAG]..."
docker compose -f docker-compose.prod.yml build \
  gateway-service auth-service reclusorio-service \
  notification-service realtime-service reclusorio-web

for svc in gateway-service auth-service reclusorio-service notification-service realtime-service reclusorio-web; do
  docker tag "icms/$svc:latest" "icms/$svc:$IMAGE_TAG"
done

# ---- 3. Swarm --------------------------------------------------------
if [[ "$(docker info --format '{{.Swarm.LocalNodeState}}')" != "active" ]]; then
  echo "🐝 Este nodo no está en un swarm: inicializando..."
  docker swarm init
fi

# ---- 4. Deploy -------------------------------------------------------
echo "🚀 Desplegando stack 'reclusorio'..."
docker stack deploy --resolve-image never -c docker-stack.yml reclusorio

echo
echo "✅ Stack desplegado. Estado:"
docker stack services reclusorio
echo
echo "   Frontend:  https://<IP-del-servidor>/  (certificado autofirmado: el"
echo "              navegador pedirá aceptar la excepción la primera vez)"
echo "   Monitoreo: docker stack ps reclusorio | docker service logs reclusorio_<servicio>"
echo
echo "   Usuarios y permisos se administran desde el módulo /usuarios del"
echo "   sistema (requiere users:read/users:write/permissions:write)."
