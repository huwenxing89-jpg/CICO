#!/bin/bash
# 回滚脚本
# 将应用回滚到上一个版本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 从环境变量读取配置
SERVER="${DEPLOY_SERVER}"
USER="${DEPLOY_USER}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/app}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
VERSION="${1:-}"

echo -e "${YELLOW}===== 开始回滚 =====${NC}"
echo "服务器: ${USER}@${SERVER}"
echo "部署路径: ${DEPLOY_PATH}"
echo ""

# 如果没有指定版本，回滚到上一个版本
if [ -z "$VERSION" ]; then
  echo -e "${YELLOW}获取版本列表...${NC}"
  VERSIONS=$(ssh "${USER}@${SERVER}" "ls -t ${DEPLOY_PATH}/releases/ 2>/dev/null || echo ''")

  if [ -z "$VERSIONS" ]; then
    echo -e "${RED}错误: 未找到任何版本${NC}"
    exit 1
  fi

  # 获取当前版本
  CURRENT_VERSION=$(ssh "${USER}@${SERVER}" "readlink ${DEPLOY_PATH}/current 2>/dev/null | xargs basename || echo ''")

  # 获取上一个版本
  PREVIOUS_VERSION=$(echo "$VERSIONS" | grep -v "^${CURRENT_VERSION}$" | head -n 1)

  if [ -z "$PREVIOUS_VERSION" ]; then
    echo -e "${RED}错误: 未找到可回滚的版本${NC}"
    exit 1
  fi

  VERSION="$PREVIOUS_VERSION"
fi

echo -e "${YELLOW}回滚到版本: ${VERSION}${NC}"
echo ""

# 确认操作
read -p "确认回滚到版本 ${VERSION}? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}取消回滚${NC}"
  exit 0
fi

# 切换版本
echo -e "${YELLOW}切换版本...${NC}"
ssh "${USER}@${SERVER}" "ln -sfn ${DEPLOY_PATH}/releases/${VERSION} ${DEPLOY_PATH}/current"

# 重载 PM2
echo -e "${YELLOW}重载 PM2 应用...${NC}"
ssh "${USER}@${SERVER}" "cd ${DEPLOY_PATH}/current && pm2 reload ecosystem.config.cjs --env production"

# 等待应用启动
echo -e "${YELLOW}等待应用启动...${NC}"
sleep 5

# 健康检查
echo -e "${YELLOW}执行健康检查...${NC}"
HEALTH_CHECK_CMD="cd ${DEPLOY_PATH}/current && ./scripts/health-check.sh"
if ssh "${USER}@${SERVER}" "$HEALTH_CHECK_CMD"; then
  echo -e "${GREEN}健康检查通过${NC}"
else
  echo -e "${RED}健康检查失败！回滚可能未成功${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}===== 回滚成功 =====${NC}"
echo "版本: ${VERSION}"
echo "回滚时间: $(date)"
echo ""
