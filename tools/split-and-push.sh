#!/usr/bin/env bash
# =====================================================================
# Separa este monorepo en repos independientes y (opcionalmente) los sube
# a la organización de GitHub. Ejecútalo desde la raíz del repo, en TU máquina
# (tu `gh`/git ya tiene acceso a la organización).
#
#   ORG=C5Desarrollos ./tools/split-and-push.sh           # genera y sube
#   ORG=C5Desarrollos PUSH=0 ./tools/split-and-push.sh     # solo genera (.split-out/)
#   ORG=C5Desarrollos FORCE=1 ./tools/split-and-push.sh    # push --force (sobrescribe)
# =====================================================================
set -euo pipefail

ORG="${ORG:-C5Desarrollos}"
PUSH="${PUSH:-1}"
FORCE="${FORCE:-0}"
BASE_URL="${BASE_URL:-https://github.com}"
OUT=".split-out"

echo "▶ Generando repos en $OUT ..."
node "$(dirname "$0")/split/generate.mjs"

push_one() {
  local repo="$1"
  ( cd "$OUT/$repo"
    git init -q -b main
    git add -A
    git -c user.email=split@local -c user.name=split commit -qm "chore: initial split from monorepo" || true
    if [ "$PUSH" = "1" ]; then
      git remote remove origin 2>/dev/null || true
      git remote add origin "$BASE_URL/$ORG/$repo.git"
      if [ "$FORCE" = "1" ]; then
        git push -u --force origin main
      else
        git push -u origin main
      fi
      echo "  ✔ subido: $ORG/$repo"
    else
      echo "  ✔ generado (sin push): $repo"
    fi
  )
}

# base-shared primero (los servicios dependen de él)
push_one "base-shared"
for d in "$OUT"/base-*-service; do
  push_one "$(basename "$d")"
done

cat <<EOF

=====================================================================
LISTO. Siguientes pasos (una sola vez):

1) Publicar el núcleo compartido:
     cd $OUT/base-shared
     git tag v1.0.0 && git push origin v1.0.0
   El workflow .github/workflows/publish.yml publica @c5desarrollos/shared
   en GitHub Packages de la organización.

2) Token para instalar el paquete privado (local, CI y Docker):
     export NODE_AUTH_TOKEN=<PAT con scope read:packages>
   Los servicios ya traen un .npmrc que lo usa.

3) En cada servicio:
     pnpm install && pnpm start:dev
   Docker:
     docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -t <repo> .
=====================================================================
EOF
