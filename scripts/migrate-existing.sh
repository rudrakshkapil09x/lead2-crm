#!/usr/bin/env bash
set -euo pipefail
# Set COMPOSE_PROJECT_NAME to the original installation's project name on upgrade.
lead2_compose_file=${COMPOSE_FILE:-docker-compose.yml}
printf '%s\n' 'Applying Lead2 v3 schema in one transaction. A database backup should be retained before migration.'
cat apps/api/db/schema.sql apps/api/db/migrations/003-lead2.sql | docker compose -f "$lead2_compose_file" exec -T postgres psql --single-transaction -v ON_ERROR_STOP=1 -U crm_owner -d crm
printf '%s\n' 'Migration complete.'
