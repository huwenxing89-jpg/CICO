# 回滚脚本 (Windows PowerShell 版本)
# 将应用回滚到上一个版本

param(
    [string]$Server = $env:DEPLOY_SERVER,
    [string]$User = $env:DEPLOY_USER,
    [string]$DeployPath = $env:DEPLOY_PATH,
    [string]$HealthUrl = $env:HEALTH_URL,
    [string]$Version = ""
)

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

$ErrorActionPreference = "Stop"

Write-ColorOutput "===== 开始回滚 =====" "Cyan"
Write-ColorOutput "服务器: ${User}@${Server}" "White"
Write-ColorOutput "部署路径: $DeployPath" "White"
Write-Host ""

# 如果没有指定版本，回滚到上一个版本
if ([string]::IsNullOrEmpty($Version)) {
    Write-ColorOutput "获取版本列表..." "Yellow"

    $versionsList = ssh "${User}@${Server}" "dir /B /O-D `"$DeployPath\releases`" 2>nul" 2>&1

    if ([string]::IsNullOrEmpty($versionsList)) {
        Write-ColorOutput "错误: 未找到任何版本" "Red"
        exit 1
    }

    # 获取当前版本
    $currentLink = ssh "${User}@${Server}" "dir `"$DeployPath\current`" 2>nul | findstr /C:`"<SYMLINKD>`"" 2>&1
    $currentVersion = ""
    if ($currentLink) {
        # 解析符号链接
        $currentPath = ssh "${User}@${Server}" "(for %i in (`"$DeployPath\current`") do @echo %~i)" 2>&1
        if ($currentPath) {
            $currentVersion = Split-Path -Leaf $currentPath
        }
    }

    Write-ColorOutput "当前版本: $currentVersion" "White"

    # 获取上一个版本
    $versions = $versionsList -split "`n"
    $previousVersion = ($versions | Where-Object { $_ -ne $currentVersion } | Select-Object -First 1)

    if ([string]::IsNullOrEmpty($previousVersion)) {
        Write-ColorOutput "错误: 未找到可回滚的版本" "Red"
        exit 1
    }

    $Version = $previousVersion
}

Write-ColorOutput "回滚到版本: $Version" "White"
Write-Host ""

# 确认操作
$confirmation = Read-Host "确认回滚到版本 $Version? (y/N)"
if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-ColorOutput "取消回滚" "Yellow"
    exit 0
}

# 切换版本
Write-ColorOutput "切换版本..." "Yellow"
ssh "${User}@${Server}" @"
# 删除当前符号链接
if exist "$DeployPath\current" (
    rmdir "$DeployPath\current"
)

# 创建新的符号链接
mklink /D "$DeployPath\current" "$DeployPath\releases\$Version"
"@ 2>&1 | Out-Null

# 重载 PM2
Write-ColorOutput "重载 PM2 应用..." "Yellow"
ssh "${User}@${Server}" "cd /d `"$DeployPath\current`" && pm2 reload ecosystem.config.cjs --env production" 2>&1

# 等待应用启动
Write-ColorOutput "等待应用启动..." "Yellow"
Start-Sleep -Seconds 5

# 健康检查
Write-ColorOutput "执行健康检查..." "Yellow"
$healthCheckCommand = "powershell -ExecutionPolicy Bypass -File `"$DeployPath\current\scripts\health-check.ps1`""
$healthResult = ssh "${User}@${Server}" $healthCheckCommand

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "健康检查通过" "Green"
} else {
    Write-ColorOutput "健康检查失败！回滚可能未成功" "Red"
    exit 1
}

Write-Host ""
Write-ColorOutput "===== 回滚成功 =====" "Green"
Write-ColorOutput "版本: $Version" "White"
Write-ColorOutput "回滚时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "White"
Write-Host ""
