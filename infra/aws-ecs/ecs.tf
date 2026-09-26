# IAM — ECS Task Execution Role (pull ECR images, write CloudWatch logs, read Secrets Manager)
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service"; identifiers = ["ecs-tasks.amazonaws.com"] }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}
resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-secrets"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow"; Action = ["secretsmanager:GetSecretValue"]; Resource = [aws_secretsmanager_secret.app.arn] }]
  })
}

# IAM — ECS Task Role (what the running containers can call)
resource "aws_iam_role" "task" {
  name               = "${local.prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}
resource "aws_iam_role_policy" "task_ses" {
  name = "ses-send"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow"; Action = ["ses:SendEmail", "ses:SendRawEmail"]; Resource = ["*"] }]
  })
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${local.prefix}-cluster"
  setting { name = "containerInsights"; value = "enabled" }
  tags = local.tags
}

# CloudWatch log groups
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.prefix}-api"
  retention_in_days = 30
  tags              = local.tags
}
resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.prefix}-web"
  retention_in_days = 14
  tags              = local.tags
}

# ECS Task Definitions
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{
    name      = "api"
    image     = "${aws_ecr_repository.api.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 4000; protocol = "tcp" }]
    secrets = [for k, v in jsondecode(aws_secretsmanager_secret_version.app.secret_string) : { name = k; valueFrom = "${aws_secretsmanager_secret.app.arn}:${k}::" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = { "awslogs-group" = aws_cloudwatch_log_group.api.name; "awslogs-region" = var.aws_region; "awslogs-stream-prefix" = "api" }
    }
    healthCheck = { command = ["CMD-SHELL", "curl -f http://localhost:4000/api/health || exit 1"]; interval = 30; timeout = 5; retries = 3 }
  }])
  tags = local.tags
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.prefix}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.execution.arn
  container_definitions = jsonencode([{
    name      = "web"
    image     = "${aws_ecr_repository.web.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 3000; protocol = "tcp" }]
    environment = [
      { name = "API_INTERNAL_URL"; value = "http://${local.prefix}-api.${local.prefix}.local:4000" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = { "awslogs-group" = aws_cloudwatch_log_group.web.name; "awslogs-region" = var.aws_region; "awslogs-stream-prefix" = "web" }
    }
  }])
  tags = local.tags
}

# ECS Services
resource "aws_ecs_service" "api" {
  name            = "${local.prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 4000
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  tags = local.tags
}

resource "aws_ecs_service" "web" {
  name            = "${local.prefix}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }
  tags = local.tags
}
