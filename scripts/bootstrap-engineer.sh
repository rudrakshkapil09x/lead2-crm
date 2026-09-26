#!/usr/bin/env bash
set -euo pipefail
read -r -p 'Engineer name: ' lead2_engineer_name
read -r -p 'Engineer email: ' lead2_engineer_email
read -r -s -p 'Engineer password (12+ chars): ' lead2_engineer_password
printf '\n'
printf '%s' "$lead2_engineer_password" | docker compose -f "${COMPOSE_FILE:-docker-compose.yml}" exec -T -e ENGINEER_NAME="$lead2_engineer_name" -e ENGINEER_EMAIL="$lead2_engineer_email" api node dist/scripts/bootstrap-engineer.js "$@"
unset lead2_engineer_password
