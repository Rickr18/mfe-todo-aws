#!/usr/bin/env bash
# Sube una carpeta dist/ al bucket de la pieza e invalida en CloudFront
# SOLO los archivos estables (los que no llevan hash en el nombre).
#
#   bash infra/publicar.sh <pieza> <carpeta-dist>
#
# Estrategia de cache:
#   assets/*-<hash>.*   -> max-age 1 anio, immutable (el nombre cambia si cambia el contenido)
#   todo lo demas       -> max-age 60 s + invalidacion inmediata
#                          (index.html, config.json, registry.json, todo-*.js)
set -euo pipefail

PIEZA=${1:?"Uso: publicar.sh <mfe-shell|mfe-editor|mfe-viewer> <carpeta-dist>"}
DIST=${2:?"Falta la carpeta dist"}
REGION=us-east-1

salida() {
  aws cloudformation describe-stacks --stack-name "$PIEZA" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET=$(salida Bucket)
DISTID=$(salida DistributionId)
URL=$(salida Url)
[ -n "$BUCKET" ] && [ "$BUCKET" != "None" ] || { echo "No existe el stack $PIEZA. Ejecuta antes infra/crear-sitio.sh"; exit 1; }

tipo() {
  case "$1" in
    *.js|*.mjs) echo "text/javascript" ;;
    *.css)      echo "text/css" ;;
    *.html)     echo "text/html; charset=utf-8" ;;
    *.json)     echo "application/json" ;;
    *.svg)      echo "image/svg+xml" ;;
    *.png)      echo "image/png" ;;
    *.ico)      echo "image/x-icon" ;;
    *)          echo "application/octet-stream" ;;
  esac
}

cd "$DIST"
echo ">> Subiendo $DIST a s3://$BUCKET"

# 1) primero los archivos con hash: asi la entrada estable nunca apunta
#    a un bundle que todavia no existe
if [ -d assets ]; then
  find assets -type f | sort | while read -r f; do
    aws s3 cp "$f" "s3://$BUCKET/$f" --only-show-errors \
      --content-type "$(tipo "$f")" \
      --cache-control "public, max-age=31536000, immutable"
    echo "   $f   (cache 1 anio)"
  done
fi

# 2) despues los estables
ESTABLES=()
while read -r f; do
  aws s3 cp "$f" "s3://$BUCKET/$f" --only-show-errors \
    --content-type "$(tipo "$f")" \
    --cache-control "public, max-age=60"
  echo "   $f   (cache 60 s + invalidacion)"
  ESTABLES+=("/$f")
  [ "$f" = "index.html" ] && ESTABLES+=("/")
done < <(find . -type f ! -path './assets/*' | sed 's|^\./||' | sort)

# 3) invalidar solo lo estable
echo ">> Invalidando en CloudFront: ${ESTABLES[*]}"
INV=$(aws cloudfront create-invalidation --distribution-id "$DISTID" \
  --paths "${ESTABLES[@]}" --query Invalidation.Id --output text)
echo "   esperando a que termine la invalidacion $INV (1-2 min)…"
aws cloudfront wait invalidation-completed --distribution-id "$DISTID" --id "$INV"

echo
echo "Publicado: $URL"
