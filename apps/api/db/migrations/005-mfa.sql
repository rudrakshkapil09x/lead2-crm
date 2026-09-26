-- Lead2 v3.2: MFA / TOTP columns. Apply with --single-transaction.

ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS mfa_secret text;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;

-- Short-lived MFA challenge tokens (step-up login)
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,   -- platform_admin or user id
  platform_admin boolean NOT NULL DEFAULT false,
  tenant_id uuid,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '10 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mfa_challenge_token_idx ON mfa_challenges(token_hash);
