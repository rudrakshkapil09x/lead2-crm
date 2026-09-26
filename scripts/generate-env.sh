#!/usr/bin/env bash
set -euo pipefail
if [ -f .env ]; then echo '.env already exists; preserve its encryption keys and passwords.'; exit 1; fi
umask 077
cat > .env <<ENV
PORT=4000
POSTGRES_PASSWORD=$(openssl rand -hex 24)
CRM_APP_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
FIELD_ENCRYPTION_KEY=$(openssl rand -hex 32)
CONTACT_HASH_KEY=$(openssl rand -hex 48)
CORS_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
SITE_ADDRESS=localhost
ENV
printf '%s\n' 'Created .env. Start Docker Compose, then run scripts/bootstrap-engineer.sh.'
