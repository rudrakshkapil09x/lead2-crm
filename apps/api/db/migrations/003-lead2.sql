-- Lead2 v3: additive upgrade; apply with psql --single-transaction.
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'lead2_engineer' CHECK(role IN ('lead2_engineer','lead2_ops'));
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS token_version int NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS seat_limit int;
UPDATE tenants SET seat_limit=greatest(1,(SELECT count(*) FROM users WHERE tenant_id=tenants.id AND active)) WHERE seat_limit IS NULL;
ALTER TABLE tenants ALTER COLUMN seat_limit SET DEFAULT 1;
ALTER TABLE tenants ALTER COLUMN seat_limit SET NOT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS agreement jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS authority jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE roles SET code=CASE name WHEN 'Org Admin' THEN 'client_super_admin' WHEN 'Manager' THEN 'client_manager' ELSE 'sales_member' END WHERE code IS NULL;
UPDATE roles SET name='Client Super Admin',permissions='["*"]',authority='{"selfDiscountPct":100,"approveDiscountPct":100,"approveTotal":999999999999}' WHERE code='client_super_admin' AND name='Org Admin';
UPDATE roles SET name='Client Manager',permissions='["lead.read","lead.write","lead.assign","task.write","report.read","proposal.write","proposal.approve","team.manage"]',authority='{"selfDiscountPct":10,"approveDiscountPct":25,"approveTotal":1000000}' WHERE code='client_manager' AND name='Manager';
UPDATE roles SET name='Sales Team Member',permissions='["lead.read","lead.write","task.write","report.read","proposal.write"]',authority='{"selfDiscountPct":10,"approveDiscountPct":0,"approveTotal":0}' WHERE code='sales_member' AND name='Sales Executive';
CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_code_idx ON roles(tenant_id,code);
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS authority_override jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_ci_idx ON users(tenant_id,lower(email));
CREATE INDEX IF NOT EXISTS users_manager_idx ON users(tenant_id,manager_id);
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'open' CHECK(outcome IN ('open','won','lost'));
UPDATE pipeline_stages SET outcome=lower(name) WHERE lower(name) IN ('won','lost') AND outcome='open';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_at timestamptz;
UPDATE leads SET closed_at=updated_at WHERE status IN ('won','lost') AND closed_at IS NULL;
CREATE TABLE IF NOT EXISTS commercial_catalogs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 name text NOT NULL, currency text NOT NULL DEFAULT 'INR', tax_pct numeric(6,2) NOT NULL DEFAULT 0,
 items jsonb NOT NULL DEFAULT '[]', terms text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS proposal_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL,
 body_html text NOT NULL, questions jsonb NOT NULL DEFAULT '[]', source_filename text,
 active boolean NOT NULL DEFAULT true, version int NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id);
UPDATE proposals SET owner_id=coalesce(created_by,(SELECT owner_id FROM leads WHERE id=proposals.lead_id)) WHERE owner_id IS NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES proposal_templates(id);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS commercial_id uuid REFERENCES commercial_catalogs(id);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approval_note text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false;
UPDATE proposals SET approval_required=true WHERE discount_pct>10 AND NOT approval_required;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS valid_until date;
CREATE TABLE IF NOT EXISTS platform_audit_logs (
 id bigserial PRIMARY KEY, actor_id uuid REFERENCES platform_admins(id), action text NOT NULL,
 tenant_id uuid REFERENCES tenants(id), metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agreement_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 actor_id uuid REFERENCES platform_admins(id), seat_limit int NOT NULL, agreement jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON audit_logs(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS proposals_tenant_owner_idx ON proposals(tenant_id,owner_id);
CREATE INDEX IF NOT EXISTS tasks_tenant_assignee_idx ON tasks(tenant_id,assignee_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS requests_pending_unique_idx ON access_requests(tenant_slug,lower(email)) WHERE status='pending';
-- Defense in depth: foreign tenant references are rejected even if API validation is missed.
CREATE OR REPLACE FUNCTION lead2_check_tenant_refs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE col text; ref_table text; ref_id uuid; expected uuid;
BEGIN
 FOR i IN 0..(TG_NARGS/2 - 1) LOOP
  col := TG_ARGV[i*2]; ref_table := TG_ARGV[i*2+1];
  ref_id := (to_jsonb(NEW)->>col)::uuid;
  IF ref_id IS NOT NULL THEN
   EXECUTE format('SELECT tenant_id FROM %I WHERE id=$1',ref_table) INTO expected USING ref_id;
   IF expected IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'Invalid tenant reference: %',col USING ERRCODE='23514'; END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['commercial_catalogs','proposal_templates'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.current_tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.current_tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
DROP TRIGGER IF EXISTS lead2_refs ON users;
CREATE TRIGGER lead2_refs BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION lead2_check_tenant_refs('role_id','roles','manager_id','users');
DROP TRIGGER IF EXISTS lead2_refs ON pipeline_stages;
CREATE TRIGGER lead2_refs BEFORE INSERT OR UPDATE ON pipeline_stages FOR EACH ROW EXECUTE FUNCTION lead2_check_tenant_refs('pipeline_id','pipelines');
DROP TRIGGER IF EXISTS lead2_refs ON leads;
CREATE TRIGGER lead2_refs BEFORE INSERT OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION lead2_check_tenant_refs('pipeline_id','pipelines','stage_id','pipeline_stages','owner_id','users');
DROP TRIGGER IF EXISTS lead2_refs ON tasks;
CREATE TRIGGER lead2_refs BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION lead2_check_tenant_refs('lead_id','leads','assignee_id','users','created_by','users');
DROP TRIGGER IF EXISTS lead2_refs ON activities;
CREATE TRIGGER lead2_refs BEFORE INSERT OR UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION lead2_check_tenant_refs('lead_id','leads','user_id','users');
DROP TRIGGER IF EXISTS lead2_refs ON proposals;
CREATE TRIGGER lead2_refs BEFORE INSERT OR UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION lead2_check_tenant_refs('lead_id','leads','created_by','users','owner_id','users','template_id','proposal_templates','commercial_id','commercial_catalogs','approved_by','users');
-- Scope all application reads through the runtime role; its grants never include BYPASSRLS.
GRANT SELECT,INSERT,UPDATE,DELETE ON commercial_catalogs,proposal_templates TO crm_app;
GRANT SELECT,INSERT ON platform_audit_logs,agreement_history TO crm_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;
REVOKE UPDATE,DELETE ON audit_logs,platform_audit_logs,agreement_history FROM crm_app;
INSERT INTO lead_stage_history(tenant_id,lead_id,pipeline_id,stage_id,entered_at,changed_by)
SELECT l.tenant_id,l.id,l.pipeline_id,l.stage_id,coalesce(l.stage_entered_at,l.created_at),l.owner_id FROM leads l
WHERE NOT EXISTS(SELECT 1 FROM lead_stage_history h WHERE h.lead_id=l.id AND h.exited_at IS NULL);
