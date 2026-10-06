#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo "Docker is required"; exit 1; }
docker compose -f docker/docker-compose.yml --env-file .env config >/dev/null
docker compose -f docker/docker-compose.yml --env-file .env build
docker compose -f docker/docker-compose.yml --env-file .env up -d --remove-orphans
docker compose -f docker/docker-compose.yml --env-file .env ps
