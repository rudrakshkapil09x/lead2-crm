# Upgrade from the supplied v2 source

## Preserve data identity

Changing the directory from `perpetual-crm` to `lead2-crm` changes Docker Compose's default project name. Set `COMPOSE_PROJECT_NAME` to the original project name so the existing PostgreSQL volume is reused. Verify the original project/volume names on the host before starting the renamed checkout.

Retain the original `FIELD_ENCRYPTION_KEY` and `CONTACT_HASH_KEY`. Replacing these keys makes existing encrypted contacts unreadable or breaks duplicate matching. Preserve the database/application passwords too. Keep the original `.env` outside Git.

## Sequence

1. Test against a restored copy of the database first. Retain the original v2 source for rollback.
2. Put the updated source on the host. Copy the original `.env`; do not run the secret generator over an existing installation.
3. Add `COOKIE_SECURE` and, for the HTTPS stack, `SITE_ADDRESS`. Set `CORS_ORIGIN` to the exact browser origin. `SUPER_ADMIN_SETUP_KEY` and `NEXT_PUBLIC_API_URL` are no longer used.
4. Stop application writes during the upgrade. Keep PostgreSQL running.
5. Set the original Compose project name and the applicable Compose file, then run `scripts/backup.sh`.
6. Run `scripts/migrate-existing.sh`. It applies the base schema and `003-lead2.sql` in one transaction with stop-on-error behavior.
7. Rebuild/restart the web and API containers using that same project name. Require all users to sign in again.
8. Confirm seats, role mappings, reporting lines, templates, commercials, lead history and proposal totals in the restored/test environment before production.

The uploaded source only created three fixed client roles. If your actual database was customized to contain additional roles, duplicate case-insensitive emails or inconsistent cross-client foreign keys, clean up those conflicts in a controlled migration before applying the new uniqueness constraints. The upgrade does not silently delete or merge customer records.

## Mappings

| v2                   | v3                 |
| -------------------- | ------------------ |
| Platform Super Admin | Lead2 Engineer     |
| Org Admin            | Client Super Admin |
| Manager              | Client Manager     |
| Sales Executive      | Sales Team Member  |

Existing managers lose the legacy whole-client visibility and receive their own reporting subtree. Assign their reportees explicitly; unassigned users remain visible to the client super admin. Seat limits are initialized to at least the active-user count, then reviewed by Ops against the agreement.

Existing proposals retain their rows and values. New proposals use catalog/template snapshots. Older records without a template snapshot use a simple printable fallback. Historical lead stage records are backfilled only where missing.

## Rollback and backups

Backups use PostgreSQL's custom archive format. Rehearse `pg_restore` into a separate empty test database. Restore the matching secrets with the backup. Do not run a destructive restore into the only live database.

If rollout fails, stop application writes and restore the database backup plus original v2 application and secrets as a matched set. The v3 migration is additive, but running old and new applications concurrently is unsupported.
