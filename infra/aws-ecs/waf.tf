# WAF Web ACL on ALB — rate limiting + AWS managed rules
resource "aws_wafv2_web_acl" "main" {
  name  = "${local.prefix}-waf"
  scope = "REGIONAL"

  default_action { allow {} }

  # Rate limit: 500 req / 5 min per IP
  rule {
    name     = "RateLimit"
    priority = 1
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 500
        aggregate_key_type = "IP"
      }
    }
    visibility_config { cloudwatch_metrics_enabled = true; metric_name = "RateLimit"; sampled_requests_enabled = true }
  }

  # AWS managed rule group: common threats (SQLi, XSS, etc.)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2
    override_action { none {} }
    statement {
      managed_rule_group_statement { vendor_name = "AWS"; name = "AWSManagedRulesCommonRuleSet" }
    }
    visibility_config { cloudwatch_metrics_enabled = true; metric_name = "CommonRuleSet"; sampled_requests_enabled = true }
  }

  # Known bad inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3
    override_action { none {} }
    statement {
      managed_rule_group_statement { vendor_name = "AWS"; name = "AWSManagedRulesKnownBadInputsRuleSet" }
    }
    visibility_config { cloudwatch_metrics_enabled = true; metric_name = "BadInputs"; sampled_requests_enabled = true }
  }

  visibility_config { cloudwatch_metrics_enabled = true; metric_name = "${local.prefix}-waf"; sampled_requests_enabled = true }
  tags = local.tags
}

resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}
