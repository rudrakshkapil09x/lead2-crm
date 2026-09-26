-- Lead2 v3.3: Outbound webhooks. Apply with --single-transaction.

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_tenant_idx ON webhook_endpoints(tenant_id, active);

-- Delivery log for observability / debugging
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status_code int,
  success boolean,
  attempt int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_delivery_endpoint_idx ON webhook_deliveries(endpoint_id, created_at DESC);

-- Enable RLS on both tables
DO $$ BEGIN
  EXECUTE 'ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON webhook_endpoints';
  EXECUTE 'CREATE POLICY tenant_isolation ON webhook_endpoints USING (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
END $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON webhook_endpoints TO crm_app;
GRANT SELECT,INSERT ON webhook_deliveries TO crm_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;
