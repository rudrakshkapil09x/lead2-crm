# Security groups
resource "aws_security_group" "alb" {
  name_prefix = "${local.prefix}-alb-"
  vpc_id      = aws_vpc.main.id
  ingress { from_port = 80;  to_port = 80;  protocol = "tcp"; cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 443; to_port = 443; protocol = "tcp"; cidr_blocks = ["0.0.0.0/0"] }
  egress  { from_port = 0;   to_port = 0;   protocol = "-1";  cidr_blocks = ["0.0.0.0/0"] }
  tags = merge(local.tags, { Name = "${local.prefix}-alb-sg" })
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${local.prefix}-ecs-"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 0; to_port = 65535; protocol = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "ALB only"
  }
  egress { from_port = 0; to_port = 0; protocol = "-1"; cidr_blocks = ["0.0.0.0/0"] }
  tags = merge(local.tags, { Name = "${local.prefix}-ecs-sg" })
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${local.prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  tags               = local.tags
}

resource "aws_lb_target_group" "web" {
  name        = "${local.prefix}-web-tg"
  port        = 3000; protocol = "HTTP"; target_type = "ip"
  vpc_id      = aws_vpc.main.id
  health_check { path = "/"; healthy_threshold = 2; unhealthy_threshold = 3; interval = 30 }
  tags = local.tags
}

resource "aws_lb_target_group" "api" {
  name        = "${local.prefix}-api-tg"
  port        = 4000; protocol = "HTTP"; target_type = "ip"
  vpc_id      = aws_vpc.main.id
  health_check { path = "/api/health"; healthy_threshold = 2; unhealthy_threshold = 3; interval = 30 }
  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port = 80; protocol = "HTTP"
  default_action { type = "redirect"; redirect { port = "443"; protocol = "HTTPS"; status_code = "HTTP_301" } }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port = 443; protocol = "HTTPS"; ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn
  default_action { type = "forward"; target_group_arn = aws_lb_target_group.web.arn }
}

# Route /api/* to the API service
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  condition { path_pattern { values = ["/api/*"] } }
  action { type = "forward"; target_group_arn = aws_lb_target_group.api.arn }
}
