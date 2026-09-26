#!/usr/bin/env bash
set -euo pipefail
umask 077
mkdir -p backups
lead2_backup_path="backups/lead2-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose -f "${COMPOSE_FILE:-docker-compose.yml}" exec -T postgres pg_dump -U crm_owner -d crm -Fc > "$lead2_backup_path"
printf 'Backup written to %s\n' "$lead2_backup_path"
