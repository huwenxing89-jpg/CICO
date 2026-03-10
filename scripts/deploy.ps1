# CI/CD 自动化部署脚本 (Windows PowerShell 版本)
# 使用 WinSCP 和 SSH 部署到远程 Windows 服务器

param(
    [string]$Server = $env:DEPLOY_SERVER,
    [string]$User = $env:DEPLOY_USER,
    [string]$DeployPath = $env:DEPLOY_PATH,
    [string]$Password = $env:DEPLOY_PASSWORD,
    [string]$HealthUrl = $env:HEALTH_URL
)

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# 错误时退出
$ErrorActionPreference = "Stop"

Write-ColorOutput "===== 开始部署 =====" "Cyan"
Write-ColorOutput "服务器: ${User}@${Server}" "White"
Write-ColorOutput "部署路径: $DeployPath" "White"
Write-Host ""

# 验证必需的环境变量
if ([string]::IsNullOrEmpty($Server) -or [string]::IsNullOrEmpty($User)) {
    Write-ColorOutput "错误: 缺少必需的环境变量" "Red"
    Write-ColorOutput "需要设置: DEPLOY_SERVER, DEPLOY_USER, DEPLOY_PASSWORD" "Yellow"
    exit 1
}

# 1. 确保本地构建存在
if (!(Test-Path ".output")) {
    Write-ColorOutput "错误: 未找到 .output 目录" "Red"
    Write-ColorOutput "请先运行 'pnpm build' 构建项目" "Yellow"
    exit 1
}

# 2. 创建临时密码文件
$passwordFile = [System.IO.Path]::GetTempFileName()
$Password | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Out-File -FilePath $passwordFile

# 3. 创建 SSH 会话配置
$sessionConfig = @{
    ComputerName = $Server
    UserName = $User
    KeyPath = if ($env:SSH_PRIVATE_KEY_PATH) { $env:SSH_PRIVATE_KEY_PATH } else { $null }
}

Write-ColorOutput "检查服务器连接..." "Yellow"

# 4. 测试 SSH 连接
try {
    $testCommand = "echo 'Connection Successful'"
    if (Get-Command ssh -ErrorAction SilentlyContinue) {
        # 使用 SSH 命令
        $result = ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${User}@${Server}" $testCommand 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "SSH 连接失败"
        }
    } else {
        Write-ColorOutput "警告: 未找到 SSH 命令，请安装 OpenSSH 客户端" "Yellow"
        Write-ColorOutput "下载地址: https://github.com/PowerShell/Win32-OpenSSH/releases" "Yellow"
        exit 1
    }
} catch {
    Write-ColorOutput "错误: 无法连接到服务器 - $_" "Red"
    exit 1
}

Write-ColorOutput "服务器连接成功" "Green"
Write-Host ""

# 5. 在服务器上创建必要的目录
Write-ColorOutput "准备服务器目录..." "Yellow"
$remoteDirs = @(
    "$DeployPath",
    "$DeployPath\releases",
    "$DeployPath\current",
    "$DeployPath\logs",
    "$DeployPath\shared"
)

foreach ($dir in $remoteDirs) {
    ssh "${User}@${Server}" "if not exist `"$dir`" mkdir `"$dir`"" 2>&1 | Out-Null
}

# 6. 保存当前版本（用于回滚）
Write-ColorOutput "检查当前版本..." "Yellow"
$currentVersion = ssh "${User}@${Server}" "dir $DeployPath\current 2>$null | findstr /C:`"<SYMLINKD>`"" 2>&1
if ($currentVersion) {
    # 解析符号链接目标
    $prevVersion = ssh "${User}@${Server}" "(for %i in ($DeployPath\current) do @echo %~i)" 2>&1
    if ($prevVersion) {
        $prevVersion = Split-Path -Leaf $prevVersion
        Write-ColorOutput "当前版本: $prevVersion" "White"
    }
}

# 7. 创建新的发布目录
$version = Get-Date -Format "yyyyMMdd-HHmmss"
$releasePath = "$DeployPath\releases\$version"
Write-ColorOutput "新版本: $version" "White"
Write-ColorOutput "发布路径: $releasePath" "White"

# 8. 上传构建产物到新目录
Write-ColorOutput "上传文件..." "Yellow"

# 检查是否安装了 WinSCP
if (Get-Command WinSCP.exe -ErrorAction SilentlyContinue) {
    Write-ColorOutput "使用 WinSCP 上传文件..." "White"

    # 创建 WinSCP 脚本
    $winscpScript = @"
option batch abort
option confirm off

# 打开连接
open "${User}@${Server}"

# 同步文件（排除 node_modules）
synchronize remote -delete ".output\" "$releasePath\"

# 上传 PM2 配置
put "ecosystem.config.cjs" "$releasePath\"

# 关闭连接
exit
"@

    $winscpScriptFile = [System.IO.Path]::GetTempFileName()
    $winscpScript | Out-File -FilePath $winscpScriptFile -Encoding UTF8

    # 执行 WinSCP
    & WinSCP.exe /script=$winscpScriptFile /ini=nul /log=winscp.log
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "WinSCP 上传失败" "Red"
        exit 1
    }

    Remove-Item $winscpScriptFile
} else {
    # 使用 scp 命令
    Write-ColorOutput "使用 SCP 上传文件..." "White"
    scp -r -o StrictHostKeyChecking=no .output/* "${User}@${Server}:${releasePath}/" 2>&1
    scp -o StrictHostKeyChecking=no ecosystem.config.cjs "${User}@${Server}:${releasePath}/" 2>&1
}

# 9. 上传健康检查脚本
Write-ColorOutput "上传健康检查脚本..." "Yellow"
scp -o StrictHostKeyChecking=no scripts/health-check.ps1 "${User}@${Server}:${releasePath}\scripts\" 2>&1

# 10. 更新符号链接到新版本
Write-ColorOutput "切换到新版本..." "Yellow"
ssh "${User}@${Server}" @"
# 删除旧的符号链接
if exist "$DeployPath\current" (
    rmdir "$DeployPath\current"
)

# 创建新的符号链接（Windows 使用 mklink）
mklink /D "$DeployPath\current" "$releasePath"
"@ 2>&1 | Out-Null

# 11. 重载 PM2 应用
Write-ColorOutput "重载 PM2 应用..." "Yellow"
ssh "${User}@${Server}" "cd /d `"$DeployPath\current`" && pm2 reload ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production" 2>&1

# 12. 等待应用启动
Write-ColorOutput "等待应用启动..." "Yellow"
Start-Sleep -Seconds 5

# 13. 健康检查
Write-ColorOutput "执行健康检查..." "Yellow"
$healthCheckResult = ssh "${User}@${Server}" "powershell -ExecutionPolicy Bypass -File `"$DeployPath\current\scripts\health-check.ps1`""

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "健康检查通过" "Green"
} else {
    Write-ColorOutput "健康检查失败，执行回滚" "Red"

    if ($prevVersion) {
        ssh "${User}@${Server}" "rmdir `"$DeployPath\current`" && mklink /D `"$DeployPath\current`" `"$DeployPath\releases\$prevVersion`""
        ssh "${User}@${Server}" "cd /d `"$DeployPath\current`" && pm2 reload ecosystem.config.cjs --env production"
    }

    exit 1
}

# 14. 清理旧版本（保留最近 5 个）
Write-ColorOutput "清理旧版本..." "Yellow"
ssh "${User}@${Server}" @"
powershell -Command "& {
    Get-ChildItem '$DeployPath\releases' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 5 |
    Remove-Item -Recurse -Force
}
"@ 2>&1

Write-Host ""
Write-ColorOutput "===== 部署成功 =====" "Green"
Write-ColorOutput "版本: $version" "White"
Write-ColorOutput "部署时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "White"
Write-Host ""

# 清理临时文件
if (Test-Path $passwordFile) {
    Remove-Item $passwordFile -Force
}
