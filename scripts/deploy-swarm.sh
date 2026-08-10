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

if grep -q 'change-me-in-production' .env; then
  echo "❌ .env todavía tiene 'change-me-in-production' en JWT_SECRET. Cámbialo antes de desplegar."
  exit 1
fi

# stack deploy sustituye variables desde el entorno del shell, no lee .env.
set -a; source .env; set +a

# ---- 2. Imágenes -----------------------------------------------------
echo "🔨 Construyendo imágenes (5 servicios + frontend)..."
docker compose -f docker-compose.prod.yml build \
  gateway-service auth-service reclusorio-service \
  notification-service realtime-service reclusorio-web

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
echo "   Primer despliegue: crea usuarios con POST /api/v1/auth/register y"
echo "   otorga permisos con UPDATE users SET permissions='...' en icms_auth."
