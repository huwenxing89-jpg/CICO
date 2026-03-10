#!/bin/bash
# 健康检查脚本
# 用于验证应用是否正常运行

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
MAX_RETRIES=10
RETRY_INTERVAL=5
TIMEOUT=5

echo -e "${YELLOW}开始健康检查${NC}"
echo "目标: ${HEALTH_URL}"
echo "最大重试: ${MAX_RETRIES} 次"
echo "重试间隔: ${RETRY_INTERVAL} 秒"
echo ""

for i in $(seq 1 $MAX_RETRIES); do
  echo -n "尝试 $i/$MAX_RETRIES: "

  # 发送健康检查请求
  RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$HEALTH_URL" 2>&1)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  # 检查 HTTP 状态码
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}HTTP 200${NC}"

    # 解析 JSON 响应
    STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

    if [ "$STATUS" = "healthy" ]; then
      echo -e "${GREEN}应用状态: 健康${NC}"
      echo ""
      echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
      echo ""
      echo -e "${GREEN}健康检查通过！${NC}"
      exit 0
    else
      echo -e "${RED}应用状态: ${STATUS}${NC}"
    fi
  else
    echo -e "${RED}HTTP $HTTP_CODE${NC}"
    echo -e "${YELLOW}响应: $BODY${NC}"
  fi

  if [ $i -lt $MAX_RETRIES ]; then
    echo -e "${YELLOW}等待 ${RETRY_INTERVAL} 秒后重试...${NC}"
    sleep $RETRY_INTERVAL
  fi
done

echo ""
echo -e "${RED}健康检查失败：超过最大重试次数${NC}"
exit 1
