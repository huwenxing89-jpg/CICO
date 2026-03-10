#!/bin/bash
# CI/CD 初始化脚本
# 将 CI/CD 配置复制到现有项目

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}===== CI/CD 初始化向导 =====${NC}"
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 询问服务器类型
echo "选择服务器类型:"
echo "1) Linux (Ubuntu)"
echo "2) Windows Server"
read -p "请输入选择 (1 或 2): " server_choice

# 询问目标项目类型
echo ""
echo "选择项目类型:"
echo "1) Nuxt 3 / Vue 3"
echo "2) Next.js / React"
echo "3) Express / Koa / NestJS"
echo "4) 通用 Node.js"
read -p "请输入选择 (1-4): " project_type

# 复制 CI/CD 配置文件
echo ""
echo -e "${YELLOW}正在复制 CI/CD 配置...${NC}"

# 创建必要的目录
mkdir -p .github/workflows
mkdir -p scripts
mkdir -p server/api
mkdir -p infrastructure/nginx

# 复制 GitHub Actions 工作流
if [ "$server_choice" = "2" ]; then
    cp /path/to/cicd-template/.github/workflows/deploy-windows.yml .github/workflows/deploy-production.yml
else
    cp /path/to/cicd-template/.github/workflows/deploy-production.yml .github/workflows/deploy-production.yml
fi

cp /path/to/cicd-template/.github/workflows/ci.yml .github/workflows/ci.yml
cp /path/to/cicd-template/.github/workflows/rollback.yml .github/workflows/rollback.yml

# 复制部署脚本
if [ "$server_choice" = "2" ]; then
    cp /path/to/cicd-template/scripts/deploy.ps1 scripts/
    cp /path/to/cicd-template/scripts/health-check.ps1 scripts/
    cp /path/to/cicd-template/scripts/rollback.ps1 scripts/
    cp /path/to/cicd-template/ecosystem.windows.config.json ecosystem.config.json
else
    cp /path/to/cicd-template/scripts/deploy.sh scripts/
    cp /path/to/cicd-template/scripts/health-check.sh scripts/
    cp /path/to/cicd-template/scripts/rollback.sh scripts/
    cp /path/to/cicd-template/ecosystem.config.cjs ecosystem.config.cjs
fi

# 复制健康检查端点
cp /path/to/cicd-template/server/api/health.ts server/api/

# 复制监控指标端点（可选）
read -p "是否添加 Prometheus 监控? (y/N): " add_monitoring
if [ "$add_monitoring" = "y" ] || [ "$add_monitoring" = "Y" ]; then
    cp /path/to/cicd-template/server/api/metrics.ts server/api/
fi

# 赋予脚本执行权限
chmod +x scripts/*.sh 2>/dev/null || true

echo ""
echo -e "${GREEN}✓ CI/CD 配置已复制${NC}"

# 显示下一步说明
echo ""
echo -e "${YELLOW}===== 下一步操作 =====${NC}"
echo ""
echo "1. 修改 package.json 添加部署脚本:"
echo ""
cat <<'EOF'
{
  "scripts": {
    "build": "...",
    "deploy": "scripts/deploy.sh",
    "health-check": "scripts/health-check.sh"
  }
}
EOF
echo ""
echo "2. 配置 GitHub Secrets:"
echo ""
if [ "$server_choice" = "2" ]; then
    cat <<'EOF'
DEPLOY_SERVER=123.207.1.1
DEPLOY_USER=Administrator
DEPLOY_PASSWORD=YourPassword
DEPLOY_PATH_PRODUCTION=C:\inetpub\wwwroot\app
HEALTH_URL_PRODUCTION=http://your-server.com/api/health
EOF
else
    cat <<'EOF'
DEPLOY_SERVER=your-server.com
DEPLOY_USER=deploy
DEPLOY_PATH_PRODUCTION=/var/www/app
HEALTH_URL_PRODUCTION=https://app.example.com/api/health
SSH_PRIVATE_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
EOF
fi
echo ""
echo "3. 提交并推送到 GitHub:"
echo ""
echo "   git add ."
echo "   git commit -m 'feat: 添加 CI/CD 自动部署'"
echo "   git push origin main"
echo ""
echo -e "${GREEN}初始化完成！${NC}"
