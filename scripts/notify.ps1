# 部署通知脚本 (Windows PowerShell 版本)
# 发送部署状态到 Slack 或 Microsoft Teams

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("success", "failed", "started", "rollback")]
    [string]$Status,

    [string]$Environment = "production",
    [string]$Version = "latest",
    [int]$Duration = 0,

    [string]$SlackWebhookUrl = $env:SLACK_WEBHOOK_URL,
    [string]$TeamsWebhookUrl = $env:TEAMS_WEBHOOK_URL
)

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# 根据状态设置颜色和图标
$statusConfig = @{
    "success" = @{ Color = "#36a64f"; Icon = "✅"; Text = "Deployment Successful" }
    "failed"  = @{ Color = "#dc3545"; Icon = "❌"; Text = "Deployment Failed" }
    "started" = @{ Color = "#007bff"; Icon = "🚀"; Text = "Deployment Started" }
    "rollback" = @{ Color = "#ffc107"; Icon = "⏪"; Text = "Deployment Rolled Back" }
}

$config = $statusConfig[$Status]
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# 发送 Slack 通知
function Send-SlackNotification {
    if ([string]::IsNullOrEmpty($SlackWebhookUrl)) {
        Write-ColorOutput "未配置 Slack Webhook URL" "Yellow"
        return
    }

    Write-ColorOutput "发送 Slack 通知..." "White"

    $payload = @{
        attachments = @(
            @{
                color = $config.Color
                blocks = @(
                    @{
                        type  = "header"
                        text  = @{
                            type   = "plain_text"
                            text   = "$($config.Icon) $($config.Text)"
                            emoji  = $true
                        }
                    },
                    @{
                        type  = "section"
                        fields = @(
                            @{
                                type    = "mrkdwn"
                                text    = "*Environment:*\n$Environment"
                            },
                            @{
                                type    = "mrkdwn"
                                text    = "*Version:*\n$Version"
                            },
                            @{
                                type    = "mrkdwn"
                                text    = "*Duration:*\n${Duration}s"
                            },
                            @{
                                type    = "mrkdwn"
                                text    = "*Time:*\n$timestamp"
                            }
                        )
                    },
                    @{
                        type     = "context"
                        elements = @(
                            @{
                                type    = "mrkdwn"
                                text    = "CI/CD Pipeline"
                            }
                        )
                    }
                )
            }
        )
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri $SlackWebhookUrl -Method Post -Body $payload -ContentType "application/json" | Out-Null
        Write-ColorOutput "Slack 通知发送成功" "Green"
    } catch {
        Write-ColorOutput "Slack 通知发送失败: $($_.Exception.Message)" "Red"
    }
}

# 发送 Microsoft Teams 通知
function Send-TeamsNotification {
    if ([string]::IsNullOrEmpty($TeamsWebhookUrl)) {
        Write-ColorOutput "未配置 Teams Webhook URL" "Yellow"
        return
    }

    Write-ColorOutput "发送 Teams 通知..." "White"

    $payload = @{
        "@type"      = "MessageCard"
        "@context"   = "https://schema.org/extensions"
        summary      = $config.Text
        themeColor   = $config.Color
        title        = "$($config.Icon) $($config.Text)"
        sections     = @(
            @{
                facts = @(
                    @{
                        name  = "Environment"
                        value = $Environment
                    },
                    @{
                        name  = "Version"
                        value = $Version
                    },
                    @{
                        name  = "Duration"
                        value = "${Duration}s"
                    },
                    @{
                        name  = "Time"
                        value = $timestamp
                    }
                )
            }
        )
        potentialAction = @(
            @{
                "@type"   = "OpenUri"
                name      = "View Repository"
                targets   = @(
                    @{
                        os  = "default"
                        uri = "https://github.com/your-org/your-repo"
                    }
                )
            }
        )
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri $TeamsWebhookUrl -Method Post -Body $payload -ContentType "application/json" | Out-Null
        Write-ColorOutput "Teams 通知发送成功" "Green"
    } catch {
        Write-ColorOutput "Teams 通知发送失败: $($_.Exception.Message)" "Red"
    }
}

# 发送所有通知
Send-SlackNotification
Send-TeamsNotification

Write-Host ""
Write-ColorOutput "通知发送完成" "Green"
