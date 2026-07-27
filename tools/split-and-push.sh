#!/usr/bin/env bash
# =====================================================================
# Separa este monorepo en repos independientes, LOS CREA en GitHub y sube el
# contenido — todo en un comando. Ejecútalo desde la raíz del repo, en TU
# máquina, tras `gh auth login`.
#
#   OWNER=AlanMora ./tools/split-and-push.sh            # cuenta personal (crea + sube)
#   OWNER=C5Desarrollos ./tools/split-and-push.sh       # una organización
#   OWNER=AlanMora PUSH=0 ./tools/split-and-push.sh      # solo generar (.split-out/)
#   OWNER=AlanMora FORCE=1 ./tools/split-and-push.sh     # sobrescribir (push --force)
#
# Requiere `gh` autenticado (gh auth login). Si `gh` no está, cae a `git push`
# y asume que los repos ya existen.
# =====================================================================
set -euo pipefail

OWNER="${OWNER:-${ORG:-AlanMora}}"
PUSH="${PUSH:-1}"
FORCE="${FORCE:-0}"
VISIBILITY="${VISIBILITY:-private}"
BASE_URL="${BASE_URL:-https://github.com}"
OUT=".split-out"

HAS_GH=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then HAS_GH=1; fi

echo "▶ Generando repos en $OUT ..."
node "$(dirname "$0")/split/generate.mjs"

push_one() {
  local repo="$1"
  ( cd "$OUT/$repo"
    git init -q -b main
    git add -A
    git -c user.email=split@local -c user.name=split commit -qm "chore: initial split from monorepo" || true

    if [ "$PUSH" != "1" ]; then
      echo "  ✔ generado (sin push): $repo"
      return
    fi

    if [ "$HAS_GH" = "1" ]; then
      # Crea el repo (si no existe) y hace push en un solo paso.
      if gh repo view "$OWNER/$repo" >/dev/null 2>&1; then
        git remote remove origin 2>/dev/null || true
        git remote add origin "$BASE_URL/$OWNER/$repo.git"
        [ "$FORCE" = "1" ] && git push -u --force origin main || git push -u origin main
      else
        gh repo create "$OWNER/$repo" --"$VISIBILITY" --source=. --remote=origin --push
      fi
      echo "  ✔ creado + subido: $OWNER/$repo"
    else
      git remote remove origin 2>/dev/null || true
      git remote add origin "$BASE_URL/$OWNER/$repo.git"
      [ "$FORCE" = "1" ] && git push -u --force origin main || git push -u origin main
      echo "  ✔ subido (repo debía existir): $OWNER/$repo"
    fi
  )
}

# base-shared primero (los servicios dependen de él)
push_one "base-shared"
for d in "$OUT"/base-*-service; do
  push_one "$(basename "$d")"
done

SCOPE_LC="@$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')"
cat <<EOF

=====================================================================
LISTO. Repos en https://github.com/$OWNER  (paquete: $SCOPE_LC/shared)

Siguientes pasos (una sola vez):

1) Publicar el núcleo compartido:
     cd $OUT/base-shared
     git tag v1.0.0 && git push origin v1.0.0
   El workflow .github/workflows/publish.yml publica $SCOPE_LC/shared
   en GitHub Packages.

2) Token para instalar el paquete privado (local, CI y Docker):
     export NODE_AUTH_TOKEN=<PAT con scope read:packages>
   Los servicios ya traen un .npmrc que lo usa.

3) En cada servicio:
     pnpm install && pnpm start:dev
   Docker:
     docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -t <repo> .
=====================================================================
EOF
