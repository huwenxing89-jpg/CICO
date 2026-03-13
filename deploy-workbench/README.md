# DevOps 部署工作台

> 一体化构建部署管理平台 - 可视化配置仓库、服务器，一键完成代码拉取、构建和部署

## 功能特性

### 🎯 核心功能
- **可视化配置管理** - 无需手动编辑配置文件，界面化配置所有参数
- **多仓库支持** - 支持 GitHub/GitLab/Gitee 等主流代码托管平台
- **分支管理** - 动态获取和切换分支，支持多分支部署
- **灵活认证** - 支持密码和 SSH 密钥两种认证方式
- **实时日志** - 终端风格的实时日志输出，支持自动滚动
- **部署进度** - 清晰的步骤进度显示，每个环节状态一目了然
- **历史记录** - 完整的部署历史，可追溯每次部署详情

### 🚀 部署流程
1. **验证配置** - 检查仓库地址和服务器配置
2. **克隆仓库** - 从 Git 仓库拉取指定分支代码
3. **安装依赖** - 自动安装项目依赖（支持 pnpm/npm/yarn）
4. **构建项目** - 执行构建命令生成生产文件
5. **上传文件** - 通过 SSH 上传构建产物到服务器
6. **部署服务** - 重启 PM2 服务（可选）
7. **验证部署** - 健康检查确认部署成功

## 技术栈

### 前端
- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Vite** - 下一代前端构建工具

### 后端
- **Node.js** - JavaScript 运行时
- **Express** - Web 应用框架
- **node-ssh** - SSH 连接和文件传输
- **simple-git** - Git 操作封装

## 快速开始

### 环境要求
- Node.js >= 20
- pnpm >= 9 (推荐) 或 npm/yarn

### 安装

```bash
# 克隆项目
git clone https://github.com/your-org/deploy-workbench.git
cd deploy-workbench

# 安装前端依赖
pnpm install

# 安装后端依赖
cd server
pnpm install
```

### 启动开发服务器

```bash
# 启动后端 API 服务
cd server
pnpm dev

# 新开终端，启动前端开发服务器
cd ..
pnpm dev
```

访问 http://localhost:5173 即可使用。

### 生产部署

```bash
# 构建前端
pnpm build

# 启动后端服务
cd server
pnpm start
```

## 使用指南

### 1. 配置仓库

在 **仓库配置** 卡片中：
- 输入仓库地址（如：`https://github.com/owner/repo.git`）
- 点击"刷新分支"获取可用分支
- 选择要部署的分支

### 2. 配置服务器

在 **服务器配置** 卡片中：
- 输入服务器地址（IP 或域名）
- 配置 SSH 端口（默认 22）
- 输入用户名（如：root 或 deploy）
- 选择认证方式：
  - **密码认证**：直接输入 SSH 密码
  - **密钥认证**：粘贴 SSH 私钥内容
- 设置部署路径（如：`/var/www/app`）
- 可选：勾选"部署后重启 PM2"

### 3. 配置构建

在 **构建配置** 卡片中：
- 选择包管理器（pnpm/npm/yarn）
- 输入构建命令（默认：`npm run build`）
- 可选：勾选"本地构建后上传"

### 4. 开始部署

1. 点击"测试连接"验证服务器配置
2. 确认配置无误后，点击"开始部署"
3. 实时查看部署日志和进度
4. 部署完成后查看结果

## 项目结构

```
deploy-workbench/
├── src/                    # 前端源码
│   ├── components/
│   │   └── ui/            # UI 组件库
│   ├── lib/               # 工具函数
│   ├── styles/            # 样式文件
│   ├── views/             # 页面组件
│   ├── App.vue            # 根组件
│   └── main.ts            # 入口文件
├── server/                # 后端源码
│   └── src/
│       ├── routes/        # API 路由
│       ├── services/      # 业务逻辑
│       └── index.ts       # 服务器入口
├── package.json           # 前端依赖
├── vite.config.ts         # Vite 配置
└── README.md              # 本文件
```

## API 接口

### POST /api/deploy
开始部署流程

**请求体**:
```json
{
  "repoUrl": "https://github.com/owner/repo.git",
  "branch": "main",
  "server": {
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "your-password",
    "path": "/var/www/app",
    "restartPm2": true
  },
  "build": {
    "packageManager": "pnpm",
    "command": "npm run build",
    "localBuild": false
  }
}
```

**响应**: Server-Sent Events (SSE) 流式日志

### POST /api/branches
获取仓库分支列表

**请求体**:
```json
{
  "repoUrl": "https://github.com/owner/repo.git"
}
```

**响应**:
```json
{
  "branches": ["main", "develop", "staging"]
}
```

### POST /api/test-connection
测试 SSH 连接

**请求体**:
```json
{
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "your-password"
}
```

**响应**:
```json
{
  "success": true
}
```

## 服务器要求

目标服务器需要安装以下组件：

```bash
# Node.js (v20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2

# 配置 PM2 开机自启
pm2 startup
```

## 安全建议

1. **使用 SSH 密钥认证** - 比密码更安全
2. **配置防火墙** - 限制 SSH 访问来源
3. **使用专用部署账户** - 避免使用 root
4. **定期更新密钥** - 定期轮换 SSH 密钥
5. **配置部署路径权限** - 确保部署账户有写权限

## 常见问题

### Q: 连接服务器失败怎么办？
A:
1. 检查服务器地址和端口是否正确
2. 确认服务器防火墙允许 SSH 连接
3. 验证用户名和密码/密钥是否正确
4. 使用"测试连接"功能验证配置

### Q: 部署后网站无法访问？
A:
1. 检查 Nginx 配置是否正确
2. 确认 PM2 服务是否正在运行：`pm2 list`
3. 查看应用日志：`pm2 logs nuxt-app`
4. 验证健康检查端点是否返回 200

### Q: 如何回滚到之前的版本？
A: 当前版本支持自动备份，可以手动执行：
```bash
cd /var/www/backups
# 找到之前的备份
pm2 reload /path/to/backup
```

## 开发路线图

- [ ] 支持多环境配置（开发/测试/生产）
- [ ] 灰度发布支持
- [ ] 蓝绿部署支持
- [ ] 部署历史对比
- [ ] WebSocket 实时通信
- [ ] 数据库迁移支持
- [ ] 部署审批流程
- [ ] 钉钉/企业微信通知集成

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**Made with ❤️ by DevOps Team**
