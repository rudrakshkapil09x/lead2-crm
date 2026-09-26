# Security group for RDS — only ECS tasks can reach it
resource "aws_security_group" "rds" {
  name_prefix = "${local.prefix}-rds-"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
    description     = "PostgreSQL from ECS tasks"
  }
  egress { from_port = 0; to_port = 0; protocol = "-1"; cidr_blocks = ["0.0.0.0/0"] }
  tags = merge(local.tags, { Name = "${local.prefix}-rds-sg" })
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.prefix}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_db_parameter_group" "pg16" {
  name   = "${local.prefix}-pg16"
  family = "postgres16"
  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # log queries > 1s
  }
  tags = local.tags
}

resource "aws_db_instance" "main" {
  identifier              = "${local.prefix}-db"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = var.db_instance
  allocated_storage       = 20
  max_allocated_storage   = 200
  storage_type            = "gp3"
  storage_encrypted       = true
  db_name                 = "crm"
  username                = "crm_owner"
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  parameter_group_name    = aws_db_parameter_group.pg16.name
  multi_az                = var.db_multi_az
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.prefix}-final-snapshot"
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"
  deletion_protection     = true
  publicly_accessible     = false
  apply_immediately       = false
  tags                    = local.tags
}
