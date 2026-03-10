#!/bin/bash
# CI/CD 自动化部署脚本
# 使用 rsync 和 SSH 部署到远程服务器

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 从环境变量读取配置
SERVER="${DEPLOY_SERVER}"
USER="${DEPLOY_USER}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/app}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"

# 验证必需的环境变量
if [ -z "$SERVER" ] || [ -z "$USER" ]; then
  echo -e "${RED}错误: 缺少必需的环境变量${NC}"
  echo "需要设置: DEPLOY_SERVER, DEPLOY_USER"
  exit 1
fi

echo -e "${YELLOW}===== 开始部署 =====${NC}"
echo "服务器: ${USER}@${SERVER}"
echo "部署路径: ${DEPLOY_PATH}"
echo ""

# 1. 确保本地构建存在
if [ ! -d ".output" ]; then
  echo -e "${RED}错误: 未找到 .output 目录${NC}"
  echo "请先运行 'pnpm build' 构建项目"
  exit 1
fi

# 2. 确保服务器 SSH 连接可用
echo -e "${YELLOW}检查服务器连接...${NC}"
if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${USER}@${SERVER}" "echo '连接成功'" > /dev/null 2>&1; then
  echo -e "${RED}错误: 无法连接到服务器${NC}"
  exit 1
fi

# 3. 在服务器上创建必要的目录
echo -e "${YELLOW}准备服务器目录...${NC}"
ssh "${USER}@${SERVER}" "mkdir -p ${DEPLOY_PATH}/{current,releases,logs,shared}"

# 4. 保存当前版本（用于回滚）
CURRENT_LINK="${DEPLOY_PATH}/current"
if ssh "${USER}@${SERVER}" "[ -L ${CURRENT_LINK} ]"; then
  PREVIOUS_VERSION=$(ssh "${USER}@${SERVER}" "readlink ${CURRENT_LINK} | xargs basename")
  echo "当前版本: ${PREVIOUS_VERSION}"
fi

# 5. 创建新的发布目录
VERSION=$(date +%Y%m%d-%H%M%S)
RELEASE_PATH="${DEPLOY_PATH}/releases/${VERSION}"
echo "新版本: ${VERSION}"

# 6. 上传构建产物到新目录
echo -e "${YELLOW}上传文件...${NC}"
rsync -avz --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  .output/ \
  ${USER}@${SERVER}:${RELEASE_PATH}/ \
  --exclude=node_modules \
  --exclude=.cache

# 7. 上传 PM2 配置
echo -e "${YELLOW}上传 PM2 配置...${NC}"
scp ecosystem.config.cjs ${USER}@${SERVER}:${RELEASE_PATH}/

# 8. 上传健康检查脚本
echo -e "${YELLOW}上传健康检查脚本...${NC}"
scp scripts/health-check.sh ${USER}@${SERVER}:${RELEASE_PATH}/scripts/
ssh "${USER}@${SERVER}" "chmod +x ${RELEASE_PATH}/scripts/health-check.sh"

# 9. 更新符号链接到新版本
echo -e "${YELLOW}切换到新版本...${NC}"
ssh "${USER}@${SERVER}" "ln -sfn ${RELEASE_PATH} ${CURRENT_LINK}"

# 10. 重载 PM2 应用
echo -e "${YELLOW}重载 PM2 应用...${NC}"
ssh "${USER}@${SERVER}" "cd ${CURRENT_PATH} && pm2 reload ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production"

# 11. 等待应用启动
echo -e "${YELLOW}等待应用启动...${NC}"
sleep 5

# 12. 健康检查
echo -e "${YELLOW}执行健康检查...${NC}"
if ssh "${USER}@${SERVER}" "${CURRENT_PATH}/scripts/health-check.sh"; then
  echo -e "${GREEN}健康检查通过${NC}"
else
  echo -e "${RED}健康检查失败，回滚部署${NC}"
  if [ -n "$PREVIOUS_VERSION" ]; then
    ssh "${USER}@${SERVER}" "ln -sfn ${DEPLOY_PATH}/releases/${PREVIOUS_VERSION} ${CURRENT_PATH}"
    ssh "${USER}@${SERVER}" "pm2 reload ecosystem.config.cjs --env production"
  fi
  exit 1
fi

# 13. 清理旧版本（保留最近 5 个）
echo -e "${YELLOW}清理旧版本...${NC}"
ssh "${USER}@${SERVER}" "cd ${DEPLOY_PATH}/releases && ls -t | tail -n +6 | xargs rm -rf"

echo ""
echo -e "${GREEN}===== 部署成功 =====${NC}"
echo "版本: ${VERSION}"
echo "部署时间: $(date)"
echo ""
