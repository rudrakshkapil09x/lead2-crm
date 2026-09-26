-- Lead2 v3.1: Recurring tasks + password reset tokens. Apply with --single-transaction.

-- Recurring task support
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule text CHECK(recurrence_rule IN ('daily','weekly','monthly'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES tasks(id);

-- Self-service password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prt_token_idx ON password_reset_tokens(token_hash) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS prt_expires_idx ON password_reset_tokens(expires_at) WHERE used_at IS NULL;
