terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  # Uncomment to use S3 backend for team usage:
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "lead2-crm/terraform.tfstate"
  #   region = var.aws_region
  # }
}

provider "aws" {
  region = var.aws_region
}

locals {
  name   = "lead2-crm"
  env    = var.environment
  prefix = "${local.name}-${local.env}"
  tags = {
    Project     = local.name
    Environment = local.env
    ManagedBy   = "terraform"
  }
}
