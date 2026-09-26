#!/usr/bin/env bash
set -euo pipefail
: "${CRM_APP_PASSWORD:?CRM_APP_PASSWORD is required}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$CRM_APP_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE crm_app LOGIN PASSWORD ' || quote_literal(:'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='crm_app') \gexec
SQL
