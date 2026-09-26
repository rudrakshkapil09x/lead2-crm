CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Platform-level administrators approve new tenant/user access requests.
CREATE TABLE IF NOT EXISTS platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz,
  approved_by uuid REFERENCES platform_admins(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL DEFAULT 'workspace' CHECK (request_type IN ('workspace','join')),
  tenant_name text,
  tenant_slug text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  requested_role text NOT NULL DEFAULT 'Sales Executive',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_tenant_id uuid REFERENCES tenants(id),
  reviewed_by uuid REFERENCES platform_admins(id),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS access_requests_status_created_idx ON access_requests(status,created_at);
CREATE INDEX IF NOT EXISTS access_requests_slug_email_idx ON access_requests(tenant_slug,lower(email));

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL, hierarchy_level int NOT NULL DEFAULT 100,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,name)
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id), manager_id uuid REFERENCES users(id), name text NOT NULL,
  email text NOT NULL, password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,email)
);
CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL, type text NOT NULL DEFAULT 'sales', is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE, name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b', position int NOT NULL, probability int NOT NULL DEFAULT 0 CHECK(probability BETWEEN 0 AND 100),
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb, entry_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(pipeline_id,position)
);
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id), stage_id uuid NOT NULL REFERENCES pipeline_stages(id), owner_id uuid REFERENCES users(id),
  name text NOT NULL, company text, phone_enc text, phone_hash text, email_enc text, email_hash text,
  value numeric(14,2) NOT NULL DEFAULT 0, source text, status text NOT NULL DEFAULT 'open', lost_reason text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb, last_activity_at timestamptz,
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_tenant_stage_idx ON leads(tenant_id,stage_id);
CREATE INDEX IF NOT EXISTS leads_phone_hash_idx ON leads(tenant_id,phone_hash);
CREATE INDEX IF NOT EXISTS leads_email_hash_idx ON leads(tenant_id,email_hash);
CREATE INDEX IF NOT EXISTS leads_stage_age_idx ON leads(tenant_id,stage_entered_at);

CREATE TABLE IF NOT EXISTS lead_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id),
  stage_id uuid NOT NULL REFERENCES pipeline_stages(id),
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  changed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_stage_history_lead_idx ON lead_stage_history(tenant_id,lead_id,entered_at DESC);
CREATE INDEX IF NOT EXISTS lead_stage_history_stage_idx ON lead_stage_history(tenant_id,stage_id,entered_at DESC);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id),
  type text NOT NULL, body text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE, assignee_id uuid REFERENCES users(id), created_by uuid REFERENCES users(id),
  title text NOT NULL, due_at timestamptz, recurrence text, status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id), created_by uuid REFERENCES users(id), title text NOT NULL,
  currency text NOT NULL DEFAULT 'INR', items jsonb NOT NULL DEFAULT '[]'::jsonb, subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_pct numeric(6,2) NOT NULL DEFAULT 0, tax_pct numeric(6,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0,
  terms text, status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid, action text NOT NULL, entity_type text NOT NULL, entity_id text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet, created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent additions for databases created with an earlier package version.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES platform_admins(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz NOT NULL DEFAULT now();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['roles','users','pipelines','pipeline_stages','leads','lead_stage_history','activities','tasks','proposals','audit_logs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid)', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION auth_login(p_slug text, p_email text)
RETURNS TABLE(user_id uuid, tenant_id uuid, tenant_name text, name text, email text, password_hash text, role_id uuid, role_name text, permissions jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT u.id,t.id,t.name,u.name,u.email,u.password_hash,r.id,r.name,r.permissions
  FROM tenants t JOIN users u ON u.tenant_id=t.id LEFT JOIN roles r ON r.id=u.role_id
  WHERE t.slug=p_slug AND t.status='active' AND lower(u.email)=lower(p_email) AND u.active=true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION platform_admin_login(p_email text)
RETURNS TABLE(admin_id uuid, name text, email text, password_hash text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id,p.name,p.email,p.password_hash
  FROM platform_admins p WHERE lower(p.email)=lower(p_email) AND p.active=true LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_login(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_admin_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_login(text,text) TO crm_app;
GRANT EXECUTE ON FUNCTION platform_admin_login(text) TO crm_app;
GRANT USAGE ON SCHEMA public TO crm_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO crm_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO crm_app;
