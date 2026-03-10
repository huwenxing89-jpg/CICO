# GitHub Actions OIDC 角色配置
# 用于无密钥访问云资源

# GitHub OIDC 提供商
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# 获取 GitHub 仓库的 OIDC 主题
data "aws_iam_policy_document" "github_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    action = "sts:AssumeRoleWithWebIdentity"

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # 限制只能从特定的仓库和分支访问
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [
        "repo:your-org/your-repo:ref:refs/heads/main",
        "repo:your-org/your-repo:ref:refs/heads/develop",
      ]
    }
  }
}

# OIDC 角色用于部署
resource "aws_iam_role" "github_actions_deploy" {
  name               = "github-actions-deploy-role"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json

  description = "OIDC role for GitHub Actions deployment"
}

# 部署策略（最小权限原则）
data "aws_iam_policy_document" "deploy_policy" {
  statement {
    sid       = "S3Access"
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
    resources = [
      "arn:aws:s3:::your-deployment-bucket",
      "arn:aws:s3:::your-deployment-bucket/*"
    ]
  }

  statement {
    sid       = "EC2Access"
    effect    = "Allow"
    actions   = ["ec2:DescribeInstances", "ec2:RunCommand"]
    resources = ["*"]
  }

  statement {
    sid       = "CloudWatchLogs"
    effect    = "Allow"
    actions   = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

# 附加策略到角色
resource "aws_iam_role_policy_attachment" "deploy_policy" {
  role       = aws_iam_role.github_actions_deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}

resource "aws_iam_policy" "deploy" {
  name   = "github-actions-deploy-policy"
  policy = data.aws_iam_policy_document.deploy_policy.json
}

# 输出角色 ARN 供 GitHub Actions 使用
output "github_actions_role_arn" {
  description = "OIDC Role ARN for GitHub Actions"
  value       = aws_iam_role.github_actions_deploy.arn
}
