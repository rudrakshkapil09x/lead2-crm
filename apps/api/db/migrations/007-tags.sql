-- Lead2 v3.4: Lead tags and scoring. Apply with --single-transaction.

-- Lead score (0-100)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score int NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 100);

-- Workspace-level tags
CREATE TABLE IF NOT EXISTS lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Many-to-many: leads ↔ tags
CREATE TABLE IF NOT EXISTS lead_tag_assignments (
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(lead_id, tag_id)
);
CREATE INDEX IF NOT EXISTS lta_tag_idx ON lead_tag_assignments(tag_id);

-- Enable RLS on lead_tags
DO $$ BEGIN
  EXECUTE 'ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON lead_tags';
  EXECUTE 'CREATE POLICY tenant_isolation ON lead_tags USING (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
END $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON lead_tags TO crm_app;
GRANT SELECT,INSERT,DELETE ON lead_tag_assignments TO crm_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;
