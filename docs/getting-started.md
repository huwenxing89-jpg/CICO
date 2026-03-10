# CI/CD 自动化部署系统 - 快速开始

## 黄金路径：10 分钟完成配置

本指南帮助你在 10 分钟内完成 CI/CD 系统的配置和首次部署。

---

## 选择你的服务器系统

| 系统 | 指南 | 推荐度 |
|-----|------|--------|
| **🐧 Linux** (Ubuntu 20.04+) | [继续阅读本指南](#第一步准备服务器-3-分钟) | ⭐⭐⭐⭐⭐ 推荐 |
| **🪟 Windows** (Windows Server 2019+) | [Windows 部署指南](./getting-started-windows.md) | ⭐⭐⭐ 可用 |

---

## 前提条件

确保你已经具备：

- [ ] GitHub 仓库
- [ ] 云服务器（Ubuntu 20.04+ 或 Windows Server 2019+）
- [ ] 域名（可选，用于 HTTPS）
- [ ] Node.js 20+ 和 pnpm

---

## 第一步：准备服务器 (3 分钟)

### 1.1 安装 Node.js 和 pnpm

```bash
# SSH 登录到服务器
ssh user@your-server.com

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
npm install -g pnpm
```

### 1.2 安装 PM2

```bash
sudo npm install -g pm2

# 设置 PM2 开机自启
pm2 startup
# 按照输出的指令执行
```

### 1.3 安装 Nginx

```bash
sudo apt update
sudo apt install -y nginx

# 启用 Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 1.4 创建部署目录

```bash
sudo mkdir -p /var/www/app/{releases,current,logs,shared}
sudo chown -R $USER:$USER /var/www/app
```

---

## 第二步：配置 SSH 密钥 (2 分钟)

### 2.1 生成 SSH 密钥对

在你的本地机器上：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy
```

### 2.2 添加公钥到服务器

```bash
ssh-copy-id -i ~/.ssh/github_deploy.pub user@your-server.com
```

### 2.3 测试 SSH 连接

```bash
ssh -i ~/.ssh/github_deploy user@your-server.com "echo '连接成功'"
```

---

## 第三步：配置 GitHub Secrets (2 分钟)

在你的 GitHub 仓库中，进入 **Settings > Secrets and variables > Actions**，添加以下 Secrets：

| Secret 名称 | 值 | 说明 |
|------------|-----|------|
| `DEPLOY_SERVER` | `your-server.com` | 服务器地址 |
| `DEPLOY_USER` | `deploy` | SSH 用户名 |
| `DEPLOY_PATH_PRODUCTION` | `/var/www/app` | 生产环境路径 |
| `DEPLOY_PATH_STAGING` | `/var/www/app-staging` | Staging 环境路径 |
| `HEALTH_URL_PRODUCTION` | `https://app.example.com/api/health` | 生产健康检查 URL |
| `HEALTH_URL_STAGING` | `https://staging.example.com/api/health` | Staging 健康检查 URL |
| `SSH_PRIVATE_KEY` | *(私钥内容)* | 复制 `~/.ssh/github_deploy` 的内容 |

### 添加 SSH 私钥

```bash
# 在本地读取私钥内容
cat ~/.ssh/github_deploy
```

复制全部内容（包括 `-----BEGIN` 和 `-----END` 行），粘贴到 GitHub Secret 中。

---

## 第四步：推送代码触发部署 (2 分钟)

### 4.1 更新远程仓库

```bash
git remote add origin https://github.com/your-org/your-repo.git
git branch -M main
git push -u origin main
```

### 4.2 观察部署过程

1. 访问 GitHub 仓库的 **Actions** 标签页
2. 你会看到 CI 工作流自动运行
3. 合并 PR 到 `main` 分支会触发生产部署

### 4.3 验证部署

```bash
# 在服务器上检查应用状态
ssh user@your-server.com "pm2 list"

# 检查健康状态
curl https://app.example.com/api/health
```

---

## 第五步：配置 HTTPS (可选，1 分钟)

### 5.1 安装 Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 获取 SSL 证书

```bash
sudo certbot --nginx -d app.example.com
```

### 5.3 自动续期

Certbot 会自动设置定时任务续期证书：

```bash
sudo systemctl status certbot.timer
```

---

## 部署架构图

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   开发者     │───>│  GitHub     │───>│  云服务器    │
│  (Push PR)  │    │  Actions    │    │   (SSH)     │
└─────────────┘    └─────────────┘    └─────────────┘
                            │                  │
                            v                  v
                    ┌─────────────┐    ┌─────────────┐
                    │   CI/CD     │    │    PM2      │
                    │  Workflows  │    │  Cluster    │
                    └─────────────┘    └─────────────┘
                            │                  │
                            v                  v
                    ┌─────────────┐    ┌─────────────┐
                    │   Nginx     │<───│   Nuxt 3    │
                    │     LB      │    │   App       │
                    └─────────────┘    └─────────────┘
```

---

## 常见问题

### Q: 部署失败怎么办？

检查 GitHub Actions 日志，常见原因：
- SSH 密钥配置错误
- 服务器路径不存在
- 健康检查超时

### Q: 如何手动回滚？

```bash
# 方式1: 使用 GitHub Actions
进入 Actions > Rollback Deployment > Run workflow

# 方式2: 在服务器上手动回滚
ssh user@your-server.com
cd /var/www/app
pm2 rollback
```

### Q: 如何查看日志？

```bash
# 应用日志
ssh user@your-server.com "pm2 logs"

# Nginx 日志
ssh user@your-server.com "tail -f /var/log/nginx/app-error.log"
```

---

## 下一步

- 📖 阅读 [完整文档](./README.md)
- 🔧 配置 [金丝雀部署](./canary-deployment.md)
- 📊 设置 [监控仪表板](./monitoring.md)
- 🔐 配置 [OIDC 认证](./oidc-setup.md)

---

**需要帮助？** 提交 Issue 或联系 DevOps 团队。
