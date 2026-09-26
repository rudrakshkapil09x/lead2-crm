#!/usr/bin/env bash
set -euo pipefail
if [ ! -f .env ]; then echo 'Run scripts/generate-env.sh; set SITE_ADDRESS and CORS_ORIGIN to your public domain before starting.'; exit 1; fi
export COMPOSE_FILE=docker-compose.aws.yml
docker compose build
docker compose up -d postgres --wait
./scripts/backup.sh
./scripts/migrate-existing.sh
docker compose up -d --wait
docker compose ps
