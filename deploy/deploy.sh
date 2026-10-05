#!/usr/bin/env bash
# Actualiza la app en el VPS con el último código de master. Sin costo por deploy.
# Uso en el servidor:  ~/dmt/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
sudo docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
sudo docker image prune -f >/dev/null
sudo docker compose -f docker-compose.prod.yml --env-file .env.production ps
