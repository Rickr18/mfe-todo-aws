#!/usr/bin/env bash
# Crea (o actualiza) el bucket privado + OAC + CORS + distribucion CloudFront.
#
#   bash infra/crear-sitio.sh <pieza> <sufijo> [origen-permitido]
#
#   pieza   mfe-shell | mfe-editor | mfe-viewer
#   sufijo  algo unico tuyo, p. ej. rios1234 (apellido + 4 ultimos digitos de la cuenta)
#   origen  opcional; por defecto '*'. Luego: https://dXXXX.cloudfront.net del shell
#
# Tarda entre 3 y 8 minutos: CloudFront propaga la distribucion por el mundo.
set -euo pipefail

PIEZA=${1:?"Uso: crear-sitio.sh <mfe-shell|mfe-editor|mfe-viewer> <sufijo> [origen]"}
SUFIJO=${2:?"Falta el sufijo, p. ej. rios1234"}
ORIGEN=${3:-*}
REGION=us-east-1
DIR=$(cd "$(dirname "$0")" && pwd)

case "$PIEZA" in
  mfe-shell|mfe-editor|mfe-viewer) ;;
  *) echo "Pieza no valida: $PIEZA (usa mfe-shell, mfe-editor o mfe-viewer)"; exit 1 ;;
esac

echo ">> Creando $PIEZA en la cuenta $(aws sts get-caller-identity --query Account --output text)"
echo "   bucket: $PIEZA-$SUFIJO   |   CORS: $ORIGEN"
echo "   (CloudFront tarda unos minutos, no cierres la terminal)"

aws cloudformation deploy \
  --stack-name "$PIEZA" \
  --template-file "$DIR/sitio.yaml" \
  --parameter-overrides "NombreBucket=$PIEZA-$SUFIJO" "OrigenPermitido=$ORIGEN" \
  --region "$REGION" \
  --no-fail-on-empty-changeset

echo
aws cloudformation describe-stacks --stack-name "$PIEZA" --region "$REGION" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
