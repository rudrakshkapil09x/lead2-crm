# Secrets Manager — all application secrets
resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.prefix}/app-secrets"
  recovery_window_in_days = 7
  tags                    = local.tags
}

resource "random_password" "jwt_secret"       { length = 64; special = false }
resource "random_password" "field_enc_key"    { length = 32; special = false; override_special = "abcdef0123456789" }
resource "random_password" "contact_hash_key" { length = 64; special = false }

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL        = "postgresql://crm_app:${var.db_app_password}@${aws_db_instance.main.address}:5432/crm?sslmode=require"
    JWT_SECRET          = random_password.jwt_secret.result
    FIELD_ENCRYPTION_KEY = lower(random_password.field_enc_key.result)
    CONTACT_HASH_KEY    = random_password.contact_hash_key.result
    DATABASE_SSL        = "true"
    SES_REGION          = var.aws_region
    SES_FROM_EMAIL      = var.ses_from_email
    APP_BASE_URL        = "https://${var.domain_name}"
    CORS_ORIGIN         = "https://${var.domain_name}"
    COOKIE_SECURE       = "true"
    GOOGLE_CLIENT_ID     = var.google_client_id
    GOOGLE_CLIENT_SECRET = var.google_client_secret
  })
}

terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }
}
