variable "aws_region"    { default = "ap-south-1" }
variable "environment"   { default = "production" }
variable "domain_name"   { description = "Public domain e.g. crm.example.com" }
variable "db_password"   { sensitive = true; description = "RDS master password" }
variable "db_app_password" { sensitive = true; description = "crm_app role password" }
variable "ssh_cidr"      { default = "0.0.0.0/0"; description = "CIDR for SSH bastion access (restrict in production)" }
variable "api_cpu"       { default = 512 }
variable "api_memory"    { default = 1024 }
variable "web_cpu"       { default = 256 }
variable "web_memory"    { default = 512 }
variable "db_instance"   { default = "db.t3.medium" }
variable "db_multi_az"   { default = true }
variable "ses_from_email" { default = "" }
variable "google_client_id"     { default = "" }
variable "google_client_secret" { sensitive = true; default = "" }
