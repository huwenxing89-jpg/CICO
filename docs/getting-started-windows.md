# Windows Server 部署指南

> 适用于腾讯云 Windows Server 的完整部署配置

---

## 系统要求

- Windows Server 2019 或更高版本
- PowerShell 5.1 或更高版本
- .NET Framework 4.8 或更高版本

---

## 第一步：安装 Node.js 和 pnpm (2 分钟)

### 1.1 下载并安装 Node.js

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本（推荐 20.x）
3. 运行安装程序，按默认选项安装

### 1.2 安装 pnpm

打开 **PowerShell（管理员）**：

```powershell
npm install -g pnpm
```

验证安装：

```powershell
node --version
pnpm --version
```

---

## 第二步：安装 PM2 (1 分钟)

```powershell
# 安装 PM2
npm install -g pm2

# 安装 PM2 Windows 启动服务
npm install -g pm2-windows-startup
pm2-startup install
```

---

## 第三步：启用 OpenSSH Server (2 分钟)

### 3.1 安装 OpenSSH Server

打开 **PowerShell（管理员）**：

```powershell
# 添加 OpenSSH Server 功能
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# 启动 SSH 服务
Start-Service sshd

# 设置自动启动
Set-Service -Name sshd -StartupType 'Automatic'

# 确认防火墙规则（通常自动创建）
if (!(Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue | Select-Object Name, Enabled)) {
    New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
}
```

### 3.2 配置 SSH 密钥认证（可选但推荐）

```powershell
# 创建 .ssh 目录
New-Item -Path "C:\Users\${env:USERNAME}\.ssh" -ItemType Directory -Force

# 授权公钥认证（修改 sshd_config）
$sshdConfigPath = "C:\ProgramData\ssh\sshd_config"
(Get-Content $sshdConfigPath) -replace '#PubkeyAuthentication yes', 'PubkeyAuthentication yes' | Set-Content $sshdConfigPath
(Get-Content $sshdConfigPath) -replace '#PasswordAuthentication yes', 'PasswordAuthentication no' | Set-Content $sshdConfigPath

# 重启 SSH 服务
Restart-Service sshd
```

### 3.3 添加你的公钥

将本地公钥内容添加到服务器的 `authorized_keys`：

```powershell
# 创建 authorized_keys 文件
New-Item -Path "C:\Users\${env:USERNAME}\.ssh\authorized_keys" -ItemType File -Force

# 将你的公钥粘贴到此文件中
notepad "C:\Users\${env:USERNAME}\.ssh\authorized_keys"
```

---

## 第四步：安装 Web 服务器 (3 分钟)

### 选项 A: 使用 IIS（推荐 Windows）

```powershell
# 安装 IIS
Install-WindowsFeature -name Web-Server -IncludeManagementTools

# 启用反向代理功能（需要 ARR）
# 下载并安装 Application Request Routing
# https://www.iis.net/downloads/microsoft/application-request-routing

# 重启 IIS
iisreset
```

### 选项 B: 使用 Nginx for Windows

1. 下载 [Nginx for Windows](http://nginx.org/en/download.html)
2. 解压到 `C:\nginx`
3. 安装为 Windows 服务（可选）：

```powershell
# 使用 NSSM (Non-Sucking Service Manager)
# 下载: https://nssm.cc/download
nssm install nginx C:\nginx\nginx.exe
nssm start nginx
```

---

## 第五步：创建部署目录 (1 分钟)

```powershell
# 创建部署目录结构
New-Item -Path "C:\inetpub\wwwroot\app" -ItemType Directory -Force
New-Item -Path "C:\inetpub\wwwroot\app\releases" -ItemType Directory -Force
New-Item -Path "C:\inetpub\wwwroot\app\current" -ItemType Directory -Force
New-Item -Path "C:\inetpub\wwwroot\app\logs" -ItemType Directory -Force
New-Item -Path "C:\inetpub\wwwroot\app\shared" -ItemType Directory -Force
```

---

## 第六步：配置 GitHub Secrets (2 分钟)

在 GitHub 仓库设置中添加以下 Secrets：

| Secret 名称 | 值 | 示例 |
|------------|-----|------|
| `DEPLOY_SERVER` | 服务器 IP 或域名 | `123.207.1.1` |
| `DEPLOY_USER` | Windows 用户名 | `Administrator` |
| `DEPLOY_PASSWORD` | 用户密码 | `YourPassword123` |
| `DEPLOY_PATH_PRODUCTION` | 部署路径 | `C:\inetpub\wwwroot\app` |
| `HEALTH_URL_PRODUCTION` | 健康检查 URL | `http://your-server.com/api/health` |
| `SSH_PRIVATE_KEY` | SSH 私钥内容 | `-----BEGIN OPENSSH...` |

### 配置说明

对于 **腾讯云 Windows Server**：

```
DEPLOY_SERVER: 你的公网 IP（如 123.207.1.1）
DEPLOY_USER: Administrator（或你的管理员账户）
DEPLOY_PASSWORD: 设置的管理员密码
```

---

## 第七步：配置防火墙规则 (1 分钟)

```powershell
# 允许 SSH (端口 22)
New-NetFirewallRule -DisplayName "Allow SSH" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow

# 允许 HTTP (端口 80)
New-NetFirewallRule -DisplayName "Allow HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# 允许 HTTPS (端口 443)
New-NetFirewallRule -DisplayName "Allow HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# 允许应用端口 (3000)
New-NetFirewallRule -DisplayName "Allow Node.js App" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

---

## 第八步：测试连接和部署

### 8.1 本地测试 SSH 连接

```powershell
ssh Administrator@123.207.1.1
```

### 8.2 推送代码触发部署

```bash
git push origin main
```

### 8.3 验证部署

在服务器上检查：

```powershell
# 检查 PM2 进程
pm2 list

# 检查应用日志
pm2 logs

# 检查健康状态
curl http://localhost:3000/api/health
```

---

## Windows 特定配置

### IIS 反向代理配置

创建 `C:\inetpub\wwwroot\app\web.config`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyInboundRule1" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 设置 PM2 开机自启

```powershell
# 安装 PM2 Windows 启动服务
npm install -g pm2-windows-startup
pm2-startup install

# 保存当前 PM2 进程列表
pm2 save
```

---

## 常见问题

### Q: 如何使用密码认证而不是 SSH 密钥？

A: 修改 `deploy.ps1` 脚本，在 SSH 命令中使用 `sshpass` 或配置 OpenSSH 允许密码认证：

```powershell
# 在 sshd_config 中
PasswordAuthentication yes
```

### Q: Windows 防火墙阻止连接怎么办？

A: 检查防火墙规则：

```powershell
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*SSH*"}
```

### Q: 如何查看 PM2 日志？

A: 使用以下命令：

```powershell
pm2 logs
# 或查看日志文件
Get-Content C:\inetpub\wwwroot\app\logs\nuxt-out.log -Tail 50
```

---

## Windows Server 目录结构

```
C:\inetpub\wwwroot\app\
├── releases\          # 历史版本
│   ├── 20250309-120000\
│   └── 20250309-130000\
├── current\           # 当前版本（符号链接）
├── logs\              # 日志文件
├── shared\            # 共享文件
└── ecosystem.windows.config.json
```

---

## 安全建议

1. **使用强密码**：为管理员账户设置复杂密码
2. **启用 Windows 防火墙**：只开放必要的端口
3. **定期更新**：保持 Windows Server 和 Node.js 更新
4. **使用 HTTPS**：配置 SSL 证书（使用 Let's Encrypt 或购买证书）
5. **限制远程访问**：只允许特定 IP 访问管理端口

---

**需要帮助？** 查看 [故障排查文档](./troubleshooting.md) 或提交 Issue。
