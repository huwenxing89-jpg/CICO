# 将 CI/CD 配置应用到你的项目

本指南帮助你将这套 CI/CD 系统应用到现有的 Node.js 项目。

---

## 方式 1：手动复制文件（推荐）

### 需要复制的文件

```
你的项目/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # 复制：CI 工作流
│       └── deploy-production.yml     # 复制：部署工作流
├── scripts/
│   ├── deploy.sh 或 deploy.ps1       # 复制：部署脚本
│   └── health-check.sh 或 health-check.ps1  # 复制：健康检查
├── ecosystem.config.cjs 或 ecosystem.windows.config.json  # 复制：PM2 配置
└── server/api/
    └── health.ts                     # 复制：健康检查端点
```

### 复制步骤

#### 1. 创建目录结构

```bash
# 在你的项目根目录
mkdir -p .github/workflows
mkdir -p scripts
mkdir -p server/api
```

#### 2. 复制 CI/CD 文件

从本模板复制以下文件到你的项目：

```bash
# GitHub Actions 工作流
cp path/to/cicd-template/.github/workflows/ci.yml .github/workflows/
cp path/to/cicd-template/.github/workflows/deploy-production.yml .github/workflows/

# 部署脚本（根据服务器选择）
# Linux:
cp path/to/cicd-template/scripts/deploy.sh scripts/
cp path/to/cicd-template/scripts/health-check.sh scripts/
cp path/to/cicd-template/ecosystem.config.cjs ./

# Windows:
cp path/to/cicd-template/scripts/deploy.ps1 scripts/
cp path/to/cicd-template/scripts/health-check.ps1 scripts/
cp path/to/cicd-template/ecosystem.windows.config.json ./ecosystem.config.json

# 健康检查端点
cp path/to/cicd-template/server/api/health.ts server/api/
```

#### 3. 添加执行权限

```bash
chmod +x scripts/*.sh  # Linux
```

---

## 方式 2：使用 curl 下载（快速）

```bash
# 在你的项目根目录执行

# 创建目录
mkdir -p .github/workflows scripts server/api

# 下载 GitHub Actions 工作流
curl -o .github/workflows/ci.yml https://raw.githubusercontent.com/your-org/cicd-template/main/.github/workflows/ci.yml
curl -o .github/workflows/deploy-production.yml https://raw.githubusercontent.com/your-org/cicd-template/main/.github/workflows/deploy-production.yml

# 下载部署脚本（选择 Linux 或 Windows）
curl -o scripts/deploy.sh https://raw.githubusercontent.com/your-org/cicd-template/main/scripts/deploy.sh
curl -o scripts/health-check.sh https://raw.githubusercontent.com/your-org/cicd-template/main/scripts/health-check.sh
chmod +x scripts/*.sh

# 下载 PM2 配置
curl -o ecosystem.config.cjs https://raw.githubusercontent.com/your-org/cicd-template/main/ecosystem.config.cjs

# 下载健康检查端点
curl -o server/api/health.ts https://raw.githubusercontent.com/your-org/cicd-template/main/server/api/health.ts
```

---

## 配置你的项目

### 1. 修改 package.json

添加部署相关脚本：

```json
{
  "scripts": {
    "dev": "...",
    "build": "...",
    "deploy": "scripts/deploy.sh",
    "health-check": "scripts/health-check.sh"
  }
}
```

### 2. 配置 GitHub Secrets

在你的 GitHub 仓库设置中添加：

```
DEPLOY_SERVER=your-server.com
DEPLOY_USER=deploy
DEPLOY_PASSWORD=your-password
DEPLOY_PATH_PRODUCTION=/var/www/app  # Linux
# 或 C:\inetpub\wwwroot\app  # Windows
HEALTH_URL_PRODUCTION=http://your-server.com/api/health
```

### 3. 调整构建配置

根据你的项目修改 `.github/workflows/ci.yml`：

```yaml
# 修改构建命令
- name: Build project
  run: npm run build  # 或 pnpm build / yarn build
```

### 4. 配置 PM2

修改 `ecosystem.config.cjs` 中的脚本路径：

```javascript
module.exports = {
  apps: [{
    name: 'your-app',
    script: './build/index.js',  // 改为你的构建输出路径
    // ...
  }]
}
```

---

## 支持的项目类型

| 框架 | 构建输出 | PM2 script 配置 |
|-----|---------|----------------|
| **Nuxt 3** | `.output/server/index.mjs` | `./.output/server/index.mjs` |
| **Next.js** | `.next/standalone/server.js` | `./.next/standalone/server.js` |
| **Express** | `dist/index.js` | `./dist/index.js` |
| **NestJS** | `dist/main.js` | `./dist/main.js` |
| **Vite (Vue/React)** | `dist/index.html` (需 SSR) | 使用 Nginx 直接服务 |

---

## 验证配置

```bash
# 1. 本地测试构建
npm run build

# 2. 本地测试 PM2
pm2 start ecosystem.config.cjs
pm2 list

# 3. 测试健康检查
curl http://localhost:3000/api/health

# 4. 提交代码
git add .
git commit -m "feat: 添加 CI/CD 自动部署"
git push origin main
```

---

## 故障排查

### 问题：构建失败

检查 `.github/workflows/ci.yml` 中的构建命令是否匹配你的项目。

### 问题：健康检查失败

确保你的应用有 `/api/health` 端点，或修改 `scripts/health-check.sh` 中的路径。

### 问题：PM2 启动失败

检查 `ecosystem.config.cjs` 中的 `script` 路径是否正确。

---

## 需要帮助？

- 查看 [完整文档](./README.md)
- [Linux 部署指南](./getting-started.md)
- [Windows 部署指南](./getting-started-windows.md)
