terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_security_group" "crm" {
  name_prefix = "lead2-crm-"
  description = "Lead2 CRM HTTPS and restricted SSH"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP for HTTPS redirects and certificate issuance"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "SSH for administrator"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "crm" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.crm.id]
  metadata_options {
    http_tokens = "required"
  }
  root_block_device {
    volume_type = "gp3"
    volume_size = var.disk_gb
    encrypted   = true
  }
  user_data = <<-BASH
    #!/bin/bash
    set -euo pipefail
    dnf update -y
    dnf install -y docker git curl
    systemctl enable --now docker
    usermod -aG docker ec2-user
    mkdir -p /opt/lead2-crm
    chown ec2-user:ec2-user /opt/lead2-crm
    # Install the Docker Compose plugin using the official Docker instructions
    # before running scripts/aws-start.sh. This starter does not execute a
    # remotely fetched installation script as root.
  BASH
  tags = {
    Name = "lead2-crm"
  }
}

resource "aws_eip" "crm" {
  domain   = "vpc"
  instance = aws_instance.crm.id
  tags = {
    Name = "lead2-crm-ip"
  }
}

output "public_ip" {
  value = aws_eip.crm.public_ip
}

output "ssh" {
  value = "ssh -i <key.pem> ec2-user@${aws_eip.crm.public_ip}"
}
