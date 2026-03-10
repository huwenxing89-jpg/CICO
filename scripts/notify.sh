#!/bin/bash
# 部署通知脚本
# 发送部署状态到 Slack 或 Microsoft Teams

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
DEPLOY_STATUS="${1:-success}"
ENVIRONMENT="${2:-production}"
VERSION="${3:-latest}"
DURATION="${4:-0}"

# 从环境变量读取 Webhook URL
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL:-}"

# 根据状态设置颜色和图标
case "$DEPLOY_STATUS" in
  success)
    COLOR="#36a64f"
    ICON="✅"
    STATUS_TEXT="Deployment Successful"
    ;;
  failed)
    COLOR="#dc3545"
    ICON="❌"
    STATUS_TEXT="Deployment Failed"
    ;;
  started)
    COLOR="#007bff"
    ICON="🚀"
    STATUS_TEXT="Deployment Started"
    ;;
  rollback)
    COLOR="#ffc107"
    ICON="⏪"
    STATUS_TEXT="Deployment Rolled Back"
    ;;
  *)
    COLOR="#6c757d"
    ICON="ℹ️"
    STATUS_TEXT="Deployment Update"
    ;;
esac

# 当前时间
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 发送 Slack 通知
send_slack_notification() {
  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo -e "${YELLOW}未配置 Slack Webhook URL${NC}"
    return 0
  fi

  echo "发送 Slack 通知..."

  PAYLOAD=$(cat <<EOF
{
  "attachments": [
    {
      "color": "$COLOR",
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "$ICON $STATUS_TEXT"
          }
        },
        {
          "type": "section",
          "fields": [
            {
              "type": "mrkdwn",
              "text": "*Environment:*\n$ENVIRONMENT"
            },
            {
              "type": "mrkdwn",
              "text": "*Version:*\n$VERSION"
            },
            {
              "type": "mrkdwn",
              "text": "*Duration:*\n${DURATION}s"
            },
            {
              "type": "mrkdwn",
              "text": "*Time:*\n$TIMESTAMP"
            }
          ]
        },
        {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": "CI/CD Pipeline"
            }
          ]
        }
      ]
    }
  ]
}
EOF
)

  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Slack 通知发送成功${NC}"
  else
    echo -e "${RED}Slack 通知发送失败${NC}"
  fi
}

# 发送 Microsoft Teams 通知
send_teams_notification() {
  if [ -z "$TEAMS_WEBHOOK_URL" ]; then
    echo -e "${YELLOW}未配置 Teams Webhook URL${NC}"
    return 0
  fi

  echo "发送 Teams 通知..."

  PAYLOAD=$(cat <<EOF
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "summary": "$STATUS_TEXT",
  "themeColor": "$COLOR",
  "title": "$ICON $STATUS_TEXT",
  "sections": [
    {
      "facts": [
        {
          "name": "Environment",
          "value": "$ENVIRONMENT"
        },
        {
          "name": "Version",
          "value": "$VERSION"
        },
        {
          "name": "Duration",
          "value": "${DURATION}s"
        },
        {
          "name": "Time",
          "value": "$TIMESTAMP"
        }
      ]
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View Repository",
      "targets": [
        {
          "os": "default",
          "uri": "https://github.com/your-org/your-repo"
        }
      ]
    }
  ]
}
EOF
)

  curl -s -X POST "$TEAMS_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Teams 通知发送成功${NC}"
  else
    echo -e "${RED}Teams 通知发送失败${NC}"
  fi
}

# 发送所有通知
send_slack_notification
send_teams_notification

echo ""
echo -e "${GREEN}通知发送完成${NC}"
