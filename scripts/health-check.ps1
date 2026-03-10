# 健康检查脚本 (Windows PowerShell 版本)
# 用于验证应用是否正常运行

param(
    [string]$HealthUrl = $env:HEALTH_URL,
    [int]$MaxRetries = 10,
    [int]$RetryInterval = 5,
    [int]$Timeout = 5
)

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# 默认健康检查 URL
if ([string]::IsNullOrEmpty($HealthUrl)) {
    $HealthUrl = "http://localhost:3000/api/health"
}

Write-ColorOutput "开始健康检查" "Cyan"
Write-ColorOutput "目标: $HealthUrl" "White"
Write-ColorOutput "最大重试: $MaxRetries 次" "White"
Write-ColorOutput "重试间隔: $RetryInterval 秒" "White"
Write-Host ""

# 创建 HTTP 客户端
$progressPreference = 'silentlyContinue'

for ($i = 1; $i -le $MaxRetries; $i++) {
    Write-Host -NoNewline "尝试 $i/$MaxRetries: "

    try {
        # 发送健康检查请求
        $params = @{
            Uri = $HealthUrl
            Method = 'GET'
            TimeoutSec = $Timeout
            Headers = @{
                'Accept' = 'application/json'
            }
        }

        $response = Invoke-RestMethod @params -ErrorAction Stop

        # 检查响应状态
        if ($response.status -eq "healthy") {
            Write-ColorOutput "HTTP 200" "Green"
            Write-ColorOutput "应用状态: 健康" "Green"
            Write-Host ""
            Write-Host "响应内容:"
            Write-Host ($response | ConvertTo-Json -Depth 10)
            Write-Host ""
            Write-ColorOutput "健康检查通过！" "Green"
            exit 0
        } else {
            Write-ColorOutput "HTTP 200" "Yellow"
            Write-ColorOutput "应用状态: $($response.status)" "Red"
        }
    } catch {
        # 处理错误
        if ($_.Exception.Response -ne $null) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            Write-ColorOutput "HTTP $statusCode" "Red"
        } else {
            Write-ColorOutput "请求失败: $($_.Exception.Message)" "Red"
        }
    }

    if ($i -lt $MaxRetries) {
        Write-ColorOutput "等待 $RetryInterval 秒后重试..." "Yellow"
        Start-Sleep -Seconds $RetryInterval
    }
}

Write-Host ""
Write-ColorOutput "健康检查失败：超过最大重试次数" "Red"
exit 1
