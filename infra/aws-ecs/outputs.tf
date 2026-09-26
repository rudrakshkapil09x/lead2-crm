output "alb_dns"        { value = aws_lb.main.dns_name }
output "app_url"         { value = "https://${var.domain_name}" }
output "rds_endpoint"    { value = aws_db_instance.main.address }
output "ecr_api_url"     { value = aws_ecr_repository.api.repository_url }
output "ecr_web_url"     { value = aws_ecr_repository.web.repository_url }
output "ecs_cluster"     { value = aws_ecs_cluster.main.name }
output "secrets_arn"     { value = aws_secretsmanager_secret.app.arn }
output "cloudwatch_dashboard" { value = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}" }
