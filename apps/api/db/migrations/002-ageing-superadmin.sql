-- Upgrade an existing database created by the first Lead2 CRM package.
-- Run as crm_owner. The full schema.sql is idempotent and is the source of truth.
\i /docker-entrypoint-initdb.d/001-schema.sql

-- Backfill stage history for leads that predate history tracking.
INSERT INTO lead_stage_history(tenant_id,lead_id,pipeline_id,stage_id,entered_at,changed_by)
SELECT l.tenant_id,l.id,l.pipeline_id,l.stage_id,coalesce(l.stage_entered_at,l.created_at),l.owner_id
FROM leads l
WHERE NOT EXISTS (
  SELECT 1 FROM lead_stage_history h WHERE h.tenant_id=l.tenant_id AND h.lead_id=l.id AND h.exited_at IS NULL
);
