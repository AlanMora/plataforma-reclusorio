#!/bin/sh
# Genera un certificado autofirmado si no hay uno montado en /etc/nginx/certs.
# Para usar un certificado real (propio o Let's Encrypt cuando haya dominio),
# basta montar server.crt y server.key en esa ruta: este script no los toca.
set -e

CERT_DIR=/etc/nginx/certs

if [ ! -f "$CERT_DIR/server.crt" ] || [ ! -f "$CERT_DIR/server.key" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -subj "/CN=${SERVER_NAME:-reclusorio.local}/O=Plataforma Reclusorio" \
    -keyout "$CERT_DIR/server.key" -out "$CERT_DIR/server.crt" 2>/dev/null
  echo "[cert] Certificado autofirmado generado en $CERT_DIR (CN=${SERVER_NAME:-reclusorio.local})"
else
  echo "[cert] Usando certificado existente en $CERT_DIR"
fi
