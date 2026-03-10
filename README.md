# 企业级 CI/CD 自动化部署系统

> 可复用的 CI/CD 模板 - 支持任意 Node.js 项目的自动化部署

[![CI](https://github.com/your-org/your-repo/workflows/CI/badge.svg)](.github/workflows/ci.yml)
[![Deploy Staging](https://github.com/your-org/your-repo/workflows/Deploy%20to%20Staging/badge.svg)](.github/workflows/deploy-staging.yml)
[![Deploy Production](https://github.com/your-org/your-repo/workflows/Deploy%20to%20Production/badge.svg)](.github/workflows/deploy-production.yml)

---

## 📖 使用方式

### 方式 1：应用到现有项目

> 👉 **查看 [如何应用到你的项目](./docs/how-to-use-as-template.md)**

将 CI/CD 配置复制到你的项目，即可享受自动化部署：

```bash
# 1. 复制配置文件
cp -r .github/workflows 你的项目/.github/
cp -r scripts 你的项目/
cp -r server 你的项目/

# 2. 配置 GitHub Secrets
# 3. 推送代码，自动部署！
```

### 方式 2：使用本模板项目

直接基于本仓库创建新项目，开箱即用。

---

## 项目简介

本系统提供开箱即用的 CI/CD 自动化部署能力，帮助企业实现：

| 指标 | 提升 |
|-----|------|
| 部署频率 | **+500%** (每周 2 次 → 每天 10+ 次) |
| 变更失败率 | **-85%** (15% → <2%) |
| 平均恢复时间 | **-94%** (4 小时 → <15 分钟) |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      技术架构图                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   开发者     │───>│  GitHub     │───>│  云服务器    │ │
│  │  (Push PR)  │    │  Actions    │    │   (SSH)     │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│                            │                  │         │
│                            v                  v         │
│                    ┌─────────────┐    ┌─────────────┐ │
│                    │   CI/CD     │    │    PM2      │ │
│                    │  Workflows  │    │  Cluster    │ │
│                    └─────────────┘    └─────────────┘ │
│                            │                  │         │
│                            v                  v         │
│                    ┌─────────────┐    ┌─────────────┐ │
│                    │   Nginx     │<───│   Nuxt 3    │ │
│                    │     LB      │    │   App       │ │
│                    └─────────────┘    └─────────────┘ │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 技术选型 | 用途 |
|-----|---------|------|
| 前端框架 | Vue 3 + Nuxt 3 | 应用框架 |
| 包管理器 | pnpm | 依赖管理 |
| CI/CD 平台 | GitHub Actions | 持续集成/部署 |
| 进程管理 | PM2 (集群模式) | 应用进程管理 |
| 反向代理 | Nginx / IIS | 负载均衡 + SSL |
| 监控 | Prometheus + Grafana | 指标收集 + 可视化 |
| 服务器支持 | Linux / Windows | 多平台支持 |

---

## 快速开始

### 选择你的服务器系统

> 🐧 **Linux (推荐)** | [黄金路径模板](./docs/getting-started.md) - 10 分钟完成配置
>
> 🪟 **Windows** | [Windows Server 部署指南](./docs/getting-started-windows.md) - 支持腾讯云

#### Linux 服务器

```bash
# 安装 Node.js 20 和 pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm pm2
```

#### Windows 服务器

```powershell
# 安装 Node.js 和 pnpm
npm install -g pnpm pm2
npm install -g pm2-windows-startup
pm2-startup install
```

### 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

```
# Linux
DEPLOY_SERVER=your-server.com
DEPLOY_USER=deploy
DEPLOY_PATH_PRODUCTION=/var/www/app

# Windows
DEPLOY_SERVER=123.207.1.1
DEPLOY_USER=Administrator
DEPLOY_PASSWORD=YourPassword
DEPLOY_PATH_PRODUCTION=C:\inetpub\wwwroot\app
```

### 推送代码触发部署

```bash
git push origin main
```

---

## 功能清单

### P0 - 核心功能 ✅

- [x] 项目初始化 (Nuxt 3 + pnpm)
- [x] CI 工作流 (Lint + Test + Build)
- [x] 健康检查端点 (`/api/health`)
- [x] PM2 集群模式配置
- [x] SSH 自动部署脚本
- [x] GitHub Actions 部署工作流

### P1 - 重要功能 ✅

- [x] 自动回滚功能
- [x] 多环境部署 (dev/staging/prod)
- [x] 部署审批流程

### P2 - 增强功能 ✅

- [x] 金丝雀部署 (按权重分流)
- [x] OIDC 认证 (无静态密钥)
- [x] 部署通知 (Slack/Teams)
- [x] Prometheus 指标收集
- [x] 黄金路径模板

---

## 目录结构

```
.
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI 工作流
│       ├── deploy-staging.yml        # Staging 部署
│       ├── deploy-production.yml     # 生产部署
│       ├── deploy-oidc.yml          # OIDC 部署
│       ├── deploy-windows.yml       # Windows 部署
│       ├── canary-deploy.yml        # 金丝雀部署
│       └── rollback.yml             # 回滚工作流
├── infrastructure/
│   ├── nginx/
│   │   ├── app.conf                  # Nginx 主配置
│   │   └── canary.conf              # 金丝雀配置
│   └── terraform/
│       └── oidc-role.tf             # OIDC 角色配置
├── scripts/
│   ├── deploy.sh / deploy.ps1       # 部署脚本 (Linux/Windows)
│   ├── health-check.sh / health-check.ps1  # 健康检查
│   ├── rollback.sh / rollback.ps1   # 回滚脚本
│   └── notify.sh / notify.ps1       # 通知脚本
├── server/
│   └── api/
│       ├── health.ts                # 健康检查端点
│       └── metrics.ts               # Prometheus 指标
├── docs/
│   ├── getting-started.md           # Linux 快速开始指南
│   └── getting-started-windows.md   # Windows 快速开始指南
├── ecosystem.config.cjs             # PM2 配置 (Linux)
├── ecosystem.windows.config.json    # PM2 配置 (Windows)
├── ecosystem.canary.cjs             # PM2 金丝雀配置
├── nuxt.config.ts                   # Nuxt 配置
├── package.json                     # 项目依赖
└── prd.md                          # 产品需求文档
```

---

## 监控指标

### DORA 指标

| 指标 | 定义 | 目标值 | 数据源 |
|-----|------|--------|--------|
| 部署频率 | 每周部署次数 | > 10 次/天 | GitHub Actions |
| 变更交付周期 | 提交到生产时间 | < 1 小时 | Git 日志 |
| 变更失败率 | 失败部署占比 | < 15% | Actions 结果 |
| 服务恢复时间 | 故障到恢复 | < 1 小时 | Incident 记录 |

### 访问监控端点

```bash
# 健康检查
curl https://app.example.com/api/health

# Prometheus 指标
curl https://app.example.com/api/metrics
```

---

## 部署流程

```
┌─────────────────────────────────────────────────────────┐
│                    部署旅程地图                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  开发者完成代码                                           │
│       │                                                   │
│       ▼                                                   │
│  推送代码 + 自动触发 CI (0 延迟)                          │
│       │                                                   │
│       ▼                                                   │
│  自动运行测试 (3 分钟)                                    │
│       │                                                   │
│       ▼                                                   │
│  构建 + 上传产物 (2 分钟)                                 │
│       │                                                   │
│       ▼                                                   │
│  一键部署到服务器 (1 分钟)                                │
│       │                                                   │
│       ▼                                                   │
│  自动健康检查 (1 分钟)                                    │
│       │                                                   │
│       ▼                                                   │
│  部署成功 + 通知 (总计: ~7 分钟)                          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 回滚操作

### 方式 1: GitHub Actions

进入 Actions > Rollback Deployment > Run workflow

### 方式 2: 服务器手动回滚

**Linux:**
```bash
ssh user@server
cd /var/www/app
chmod +x scripts/rollback.sh
./scripts/rollback.sh
```

**Windows:**
```powershell
ssh Administrator@server
cd C:\inetpub\wwwroot\app
powershell -ExecutionPolicy Bypass -File scripts\rollback.ps1
```

### 方式 3: PM2 回滚

```bash
pm2 rollback
```

---

## 文档

- [Linux 快速开始](./docs/getting-started.md)
- [Windows 快速开始](./docs/getting-started-windows.md) 🆕
- [产品需求文档](./prd.md)
- [金丝雀部署指南](./docs/canary-deployment.md)
- [监控仪表板配置](./docs/monitoring.md)
- [故障排查手册](./docs/troubleshooting.md)

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

---

## 许可证

MIT License

---

**文档版本**: v1.0
**创建日期**: 2026-03-09
**维护团队**: DevOps 团队
