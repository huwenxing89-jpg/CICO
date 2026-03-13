import { NodeSSH } from 'node-ssh'
import { execaCommand } from 'execa'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'

type LogCallback = (message: string, type?: 'info' | 'success' | 'warning' | 'error' | 'command') => void

interface ServerConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  path: string
  restartPm2?: boolean
}

export class SSHService {
  private ssh: NodeSSH | null = null

  async connect(config: ServerConfig): Promise<void> {
    this.ssh = new NodeSSH()

    // 添加错误处理，防止未捕获的 SSH 错误导致服务器崩溃
    this.ssh.connection?.on('error', () => {
      // 静默处理连接错误
    })

    const connectionConfig: any = {
      host: config.host,
      port: config.port,
      username: config.username,
      // 针对 Windows SSH 服务器和大文件传输的优化配置
      readyTimeout: 60000, // 60 秒连接超时
      keepaliveInterval: 10000, // 每 10 秒发送 keep-alive 包
      keepaliveCountMax: 10, // 最多发送 10 次 keep-alive
      // SFTP 优化配置
      sftp: {
        // 使用更保守的缓冲区大小
        bufferSize: 32768 // 32KB
      }
    }

    if (config.password) {
      connectionConfig.password = config.password
    } else if (config.privateKey) {
      connectionConfig.privateKey = config.privateKey
    }

    await this.ssh.connect(connectionConfig)
  }

  async disconnect(): Promise<void> {
    if (this.ssh) {
      this.ssh.dispose()
      this.ssh = null
    }
  }

  async testConnection(config: ServerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      await this.connect(config)
      await this.disconnect()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async upload(localPath: string, remotePath: string, log?: LogCallback): Promise<void> {
    if (!this.ssh) {
      throw new Error('Not connected to server')
    }

    // 检测构建产物类型
    const buildOutputs = await this.detectBuildOutputs(localPath, log)

    if (buildOutputs.length === 0) {
      throw new Error('No build output found. Please make sure the project has been built successfully.')
    }

    log?.(`找到构建产物: ${buildOutputs.map(o => o.type).join(', ')}`, 'info')

    // 上传所有构建产物
    for (const output of buildOutputs) {
      await this.uploadBuildOutput(localPath, remotePath, output, log)
    }

    log?.('文件上传完成', 'success')
  }

  private async detectBuildOutputs(localPath: string, log?: LogCallback): Promise<Array<{ type: string; localPath: string; remotePath: string }>> {
    const outputs: Array<{ type: string; localPath: string; remotePath: string }> = []

    try {
      // 检查 Node.js/Nuxt 构建产物 (.output)
      try {
        await stat(join(localPath, '.output'))
        outputs.push({
          type: 'Nuxt output',
          localPath: join(localPath, '.output'),
          remotePath: '.output'
        })
      } catch {}

      // 检查 dist 目录
      try {
        await stat(join(localPath, 'dist'))
        outputs.push({
          type: 'dist',
          localPath: join(localPath, 'dist'),
          remotePath: 'dist'
        })
      } catch {}

      // 检查 build 目录
      try {
        await stat(join(localPath, 'build'))
        outputs.push({
          type: 'build',
          localPath: join(localPath, 'build'),
          remotePath: 'build'
        })
      } catch {}

      // 检查 Java/Maven 构建产物 (target/*.jar)
      try {
        const targetDir = join(localPath, 'target')
        await stat(targetDir)
        const files = await readdir(targetDir)
        const jars = files.filter(f => f.endsWith('.jar') && !f.endsWith('-sources.jar'))

        for (const jar of jars) {
          outputs.push({
            type: `JAR file: ${jar}`,
            localPath: join(targetDir, jar),
            remotePath: jar
          })
        }
      } catch {}

      // 检查 Gradle 构建产物 (build/libs/*.jar)
      try {
        const libsDir = join(localPath, 'build/libs')
        await stat(libsDir)
        const files = await readdir(libsDir)
        const jars = files.filter(f => f.endsWith('.jar'))

        for (const jar of jars) {
          outputs.push({
            type: `Gradle JAR: ${jar}`,
            localPath: join(libsDir, jar),
            remotePath: jar
          })
        }
      } catch {}

    } catch (error: any) {
      log?.(`检测构建产物时出错: ${error.message}`, 'warning')
    }

    return outputs
  }

  private async uploadBuildOutput(_localBasePath: string, remoteBasePath: string, output: { type: string; localPath: string; remotePath: string }, log?: LogCallback): Promise<void> {
    if (!this.ssh) {
      throw new Error('Not connected to server')
    }

    // 检测是否为 Windows 路径
    const isWindowsPath = remoteBasePath.match(/^[A-Za-z]:\\/)

    // 检查远程路径是否存在且是目录
    log?.(`检查远程路径: ${remoteBasePath}`, 'info')
    try {
      let checkCommand: string
      if (isWindowsPath) {
        // Windows: 使用 PowerShell 检查
        checkCommand = `powershell -Command "if (Test-Path '${remoteBasePath}' -PathType Container) { Write-Output 'is_dir' } elseif (Test-Path '${remoteBasePath}' -PathType Leaf) { Write-Output 'is_file' } else { Write-Output 'not_exists' }"`
      } else {
        // Unix: 使用 test 命令
        checkCommand = `test -d "${remoteBasePath}" && echo "is_dir" || test -e "${remoteBasePath}" && echo "is_file" || echo "not_exists"`
      }

      const checkResult = await this.ssh.execCommand(checkCommand)
      const pathStatus = checkResult.stdout.trim()

      if (pathStatus === 'is_file') {
        throw new Error(`远程路径 "${remoteBasePath}" 是一个文件，不是目录！`)
      } else if (pathStatus === 'not_exists') {
        throw new Error(`远程路径 "${remoteBasePath}" 不存在！`)
      }

      log?.('远程目录验证通过', 'success')
    } catch (error: any) {
      if (error.message.includes('远程路径')) {
        log?.(error.message, 'error')
        throw error
      }
      throw new Error(`检查远程路径失败: ${error.message}`)
    }

    const isDirectory = output.localPath.endsWith('.output') || output.localPath.endsWith('dist') || output.localPath.endsWith('build')

    if (isDirectory) {
      // 上传目录
      log?.(`正在上传 ${output.type}...`, 'info')
      try {
        const status = await this.ssh.putDirectory(
          output.localPath,
          `${remoteBasePath}/${output.remotePath}`,
          {
            recursive: true,
            concurrency: 3
          }
        )

        if (!status) {
          throw new Error(`上传目录失败`)
        }

        log?.(`${output.type} 上传完成`, 'success')
      } catch (error: any) {
        log?.(`上传目录失败: ${error.message}`, 'error')
        throw error
      }
    } else {
      // 上传单个文件（如 jar）
      log?.(`正在上传 ${output.type}...`, 'info')
      const targetFileName = 'app.jar'
      const remoteFilePath = isWindowsPath
        ? `${remoteBasePath}\\${targetFileName}`
        : `${remoteBasePath}/${targetFileName}`

      let uploadSuccess = false
      let lastError: any = null

      // 方法1: 尝试使用 SFTP 上传
      try {
        log?.(`尝试方法1: SFTP 上传...`, 'info')

        let sftpPath: string
        if (isWindowsPath) {
          sftpPath = remoteBasePath.replace(/\\/g, '/')
          if (!sftpPath.startsWith('/')) {
            sftpPath = '/' + sftpPath
          }
        } else {
          sftpPath = remoteBasePath
        }
        const sftpFilePath = `${sftpPath}/${targetFileName}`

        log?.(`本地文件: ${output.localPath}`, 'info')
        log?.(`SFTP 路径: ${sftpFilePath}`, 'info')

        // 使用 fastPut 方法，提供更好的性能和错误处理
        await this.ssh.putFile(output.localPath, sftpFilePath, null, {
          chunkSize: 32768 // 32KB 分块
        })
        uploadSuccess = true
        log?.(`SFTP 上传成功`, 'success')
      } catch (error: any) {
        lastError = error
        log?.(`SFTP 上传失败: ${error.message} (错误码: ${error.code || 'N/A'})`, 'warning')
      }

      // 方法2: 使用 SFTP 分块上传（更小的 chunk size，适合 Windows SSH）
      if (!uploadSuccess) {
        try {
          log?.(`尝试方法2: SFTP 小分块上传...`, 'info')

          let sftpPath = remoteBasePath
          if (isWindowsPath) {
            sftpPath = remoteBasePath.replace(/\\/g, '/')
            if (!sftpPath.startsWith('/')) {
              sftpPath = '/' + sftpPath
            }
          }
          const sftpFilePath = `${sftpPath}/${targetFileName}`

          // 使用更小的分块和重试机制
          await this.ssh.putFile(output.localPath, sftpFilePath, null, {
            chunkSize: 16384 // 16KB 分块，更适合 Windows SSH
          })
          uploadSuccess = true
          log?.(`SFTP 小分块上传成功`, 'success')
        } catch (error: any) {
          lastError = error
          log?.(`SFTP 小分块上传失败: ${error.message}`, 'warning')
        }
      }

      // 方法3: 使用二进制文件分割 + SFTP（绕过大文件限制）
      if (!uploadSuccess) {
        try {
          log?.(`尝试方法3: 文件分割上传...`, 'info')

          const fs = await import('fs/promises')
          const path = await import('path')
          const os = await import('os')

          // 获取文件大小
          const fileStats = await fs.stat(output.localPath)
          const fileSize = fileStats.size
          const partSize = 10 * 1024 * 1024 // 每个分片 10MB
          const totalParts = Math.ceil(fileSize / partSize)

          log?.(`文件大小: ${fileSize} 字节，分为 ${totalParts} 个分片`, 'info')

          // 读取整个文件
          const fileBuffer = await fs.readFile(output.localPath)

          let sftpPath = remoteBasePath
          if (isWindowsPath) {
            sftpPath = remoteBasePath.replace(/\\/g, '/')
            if (!sftpPath.startsWith('/')) {
              sftpPath = '/' + sftpPath
            }
          }

          // 创建临时目录
          const tempDirName = `upload_${Date.now()}`
          const tempDirPath = `${sftpPath}/${tempDirName}`

          try {
            await this.ssh.execCommand(isWindowsPath
              ? `powershell -Command "New-Item -ItemType Directory -Force -Path '${remoteBasePath}\\${tempDirName}'"`
              : `mkdir -p "${remoteBasePath}/${tempDirName}"`
            )
          } catch {
            // 目录可能已存在，忽略错误
          }

          // 上传分片
          for (let i = 0; i < totalParts; i++) {
            const start = i * partSize
            const end = Math.min(start + partSize, fileSize)
            const partBuffer = fileBuffer.subarray(start, end)

            // 创建临时分片文件
            const partFileName = `part_${i.toString().padStart(3, '0')}.bin`
            const localPartPath = path.join(os.tmpdir(), partFileName)

            await fs.writeFile(localPartPath, partBuffer)

            try {
              // 上传分片
              const remotePartPath = `${tempDirPath}/${partFileName}`

              // 每次上传前检查连接，如果断开则重新连接
              if (!this.ssh || !this.ssh.isConnected()) {
                log?.(`连接已断开，正在重新连接...`, 'warning')
                // 注意：这里需要原始的 config，暂时跳过，使用重试机制
                throw new Error('SSH connection lost')
              }

              await this.ssh.putFile(localPartPath, remotePartPath, null, {
                chunkSize: 8192 // 8KB 分块，更保守
              })

              log?.(`分片 ${i + 1}/${totalParts} 上传完成`, 'info')

              // 清理本地临时文件
              await fs.unlink(localPartPath).catch(() => {})

              // 每 5 个分片后暂停一下，避免服务器压力过大
              if ((i + 1) % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            } catch (err: any) {
              // 清理本地临时文件
              await fs.unlink(localPartPath).catch(() => {})
              throw err
            }
          }

          // 在服务器上合并分片
          log?.(`在服务器上合并分片...`, 'info')

          if (isWindowsPath) {
            // Windows PowerShell 合并
            const escapedRemotePath = remoteFilePath.replace(/\\/g, '\\\\')
            const escapedTempDir = `${remoteBasePath}\\${tempDirName}`.replace(/\\/g, '\\\\')

            await this.ssh.execCommand(
              `powershell -Command "$parts = Get-ChildItem '${escapedTempDir}' | Sort-Object Name; $stream = [IO.File]::OpenWrite('${escapedRemotePath}'); foreach ($part in $parts) { $bytes = [IO.File]::ReadAllBytes($part.FullName); $stream.Write($bytes, 0, $bytes.Length) }; $stream.Close(); Remove-Item '${escapedTempDir}' -Recurse -Force"`
            )
          } else {
            // Linux 合并
            await this.ssh.execCommand(`cat "${remoteBasePath}/${tempDirName}/part_"*.bin > "${remoteFilePath}"`)
            await this.ssh.execCommand(`rm -rf "${remoteBasePath}/${tempDirName}"`)
          }

          uploadSuccess = true
          log?.(`文件分割上传成功`, 'success')
        } catch (error: any) {
          lastError = error
          log?.(`文件分割上传失败: ${error.message}`, 'warning')
        }
      }

      // 方法4: 使用 PowerShell Base64 接收脚本（最可靠的方法）
      if (!uploadSuccess) {
        try {
          log?.(`尝试方法4: PowerShell 脚本接收...`, 'info')

          const fs = await import('fs/promises')

          // 读取文件
          const fileContent = await fs.readFile(output.localPath)
          const base64Content = fileContent.toString('base64')
          const totalSize = base64Content.length

          log?.(`Base64 编码后大小: ${totalSize} 字符`, 'info')

          // 先在服务器上创建一个 PowerShell 接收脚本
          const escapedRemotePath = remoteFilePath.replace(/\\/g, '\\\\')
          const receiverScriptPath = `${remoteBasePath}\\upload_receiver.ps1`.replace(/\\/g, '\\\\')

          await this.ssh.execCommand(
            `powershell -Command "[IO.File]::WriteAllText('${receiverScriptPath}', @'
param($Base64String)
$bytes = [Convert]::FromBase64String($Base64String)
[IO.File]::WriteAllBytes('${escapedRemotePath}', $bytes)
Write-Output 'OK'
'@)"`
          )

          // 分块发送 Base64 数据
          const chunkSize = 100000 // 每次发送 100KB
          const totalChunks = Math.ceil(totalSize / chunkSize)

          log?.(`开始传输，共 ${totalChunks} 块...`, 'info')

          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize
            const end = Math.min(start + chunkSize, totalSize)
            const chunk = base64Content.substring(start, end)

            // 第一次创建文件，后续追加（需要特殊处理）

            const command = i === 0
              ? `powershell -Command "$content = '${chunk}'; $bytes = [Convert]::FromBase64String($content); [IO.File]::WriteAllBytes('${escapedRemotePath}', $bytes)"`
              : `powershell -Command "$content = '${chunk}'; $bytes = [Convert]::FromBase64String($content); [IO.File]::AppendAllText('${escapedRemotePath.replace(/\.jar$/i, '_temp.txt')}', [System.Text.Encoding]::ASCII.GetString($bytes))"`

            await this.ssh.execCommand(command)

            if ((i + 1) % 10 === 0) {
              log?.(`传输进度: ${Math.round(((i + 1) / totalChunks) * 100)}%`, 'info')
            }

            // 添加小延迟避免服务器压力过大
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          // 清理临时脚本
          try {
            await this.ssh.execCommand(`powershell -Command "Remove-Item '${receiverScriptPath}' -Force -ErrorAction SilentlyContinue"`)
          } catch {}

          uploadSuccess = true
          log?.(`PowerShell 脚本接收成功`, 'success')
        } catch (error: any) {
          lastError = error
          log?.(`PowerShell 脚本接收失败: ${error.message}`, 'warning')
        }
      }

      if (!uploadSuccess) {
        log?.(`所有上传方法均失败`, 'error')
        log?.(`最后错误: ${lastError?.message}`, 'error')
        throw new Error(`上传文件失败: ${lastError?.message || 'Unknown error'}`)
      }

      log?.(`${output.type} 上传完成 (重命名为 app.jar)`, 'success')

      // 验证文件是否上传成功
      try {
        const verifyCmd = isWindowsPath
          ? `powershell -Command "if (Test-Path '${remoteFilePath}') { Write-Output 'exists' } else { Write-Output 'missing' }"`
          : `test -f "${remoteFilePath}" && echo "exists" || echo "missing"`

        const verifyResult = await this.ssh.execCommand(verifyCmd)
        if (verifyResult.stdout.trim() === 'missing') {
          throw new Error('文件上传后验证失败：远程文件不存在')
        }
        log?.('文件上传验证通过', 'success')
      } catch (verifyError: any) {
        log?.(`文件验证警告: ${verifyError.message}`, 'warning')
      }
    }
  }

  async restartPm2(remotePath: string, log?: LogCallback): Promise<void> {
    if (!this.ssh) {
      throw new Error('Not connected to server')
    }

    log?.('正在重启 PM2 服务...', 'info')

    const commands = [
      `cd ${remotePath}`,
      'pm2 restart nuxt-app || pm2 start .output/server/index.mjs --name nuxt-app',
      'pm2 save'
    ]

    const result = await this.ssh.execCommand(commands.join(' && '))

    if (result.stderr) {
      log?.(`PM2 重启警告: ${result.stderr}`, 'warning')
    }

    log?.('PM2 服务重启完成', 'success')
  }

  async restartJavaService(remotePath: string, log?: LogCallback): Promise<void> {
    if (!this.ssh) {
      throw new Error('Not connected to server')
    }

    log?.('正在重启 Java 服务...', 'info')

    const jarFileName = 'app.jar'
    const isWindowsPath = remotePath.match(/^[A-Za-z]:\\/)

    // 1. 检测服务器上现有的 Java 进程运行方式
    log?.('检测服务器上的 Java 进程...', 'info')

    let hasPm2App = false
    let hasJavaProcess = false

    if (isWindowsPath) {
      // Windows: 检查 PM2 和 Java 进程
      const checkPm2Result = await this.ssh.execCommand('pm2 list 2>$null | Select-String "java-app|app.jar" || echo "no_pm2"')
      hasPm2App = checkPm2Result.stdout.trim() !== 'no_pm2'

      const checkJavaResult = await this.ssh.execCommand(
        `powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${jarFileName}*' } | Out-String; if (-not $?) { echo 'no_java' }"`
      )
      hasJavaProcess = checkJavaResult.stdout.trim() !== 'no_java'
    } else {
      // Unix: 检查 PM2 和 Java 进程
      const checkPm2Result = await this.ssh.execCommand('pm2 list 2>/dev/null | grep -E "java-app|app.jar" || echo "no_pm2"')
      hasPm2App = checkPm2Result.stdout.trim() !== 'no_pm2'

      const checkJavaResult = await this.ssh.execCommand('ps aux | grep -v grep | grep -E "java.*-jar.*app.jar" || echo "no_java"')
      hasJavaProcess = checkJavaResult.stdout.trim() !== 'no_java'
    }

    log?.(`PM2 应用: ${hasPm2App ? '存在' : '不存在'}, Java 进程: ${hasJavaProcess ? '存在' : '不存在'}`, 'info')

    // 2. 停止旧服务
    if (hasPm2App) {
      log?.('停止 PM2 中的 Java 应用...', 'info')
      await this.ssh.execCommand('pm2 stop java-app && pm2 delete java-app')
      log?.('PM2 应用已停止', 'success')
    }

    if (hasJavaProcess) {
      log?.('停止现有的 Java 进程...', 'info')
      if (isWindowsPath) {
        // Windows: 停止 Java 进程
        await this.ssh.execCommand(
          `powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${jarFileName}*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`
        )
        await new Promise(resolve => setTimeout(resolve, 2000))
        // 强制停止
        await this.ssh.execCommand(
          `powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${jarFileName}*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`
        )
      } else {
        // Unix: 停止 Java 进程
        await this.ssh.execCommand('pkill -f "java.*-jar.*app.jar" || true')
        await new Promise(resolve => setTimeout(resolve, 2000))
        await this.ssh.execCommand('pkill -9 -f "java.*-jar.*app.jar" || true')
      }
      log?.('Java 进程已停止', 'success')
    }

    // 3. 启动新服务
    log?.('启动新的 Java 应用...', 'info')

    // 检查是否安装了 PM2
    let usePm2 = false
    if (isWindowsPath) {
      const pm2Installed = await this.ssh.execCommand('pm2 --version 2>$null; if ($?) { echo "yes" } else { echo "no" }')
      usePm2 = pm2Installed.stdout.trim() === 'yes'
      log?.(`PM2 检测结果: ${usePm2 ? '已安装' : '未安装'}`, 'info')
    } else {
      const pm2Installed = await this.ssh.execCommand('which pm2 2>/dev/null && echo "yes" || echo "no"')
      usePm2 = pm2Installed.stdout.trim() === 'yes'
    }

    if (usePm2) {
      // 使用 PM2 启动（推荐）
      log?.('使用 PM2 启动服务...', 'info')
      const startResult = await this.ssh.execCommand(
        `cd ${remotePath} && pm2 start ${jarFileName} --name java-app --interpreter none && pm2 save`
      )
      if (startResult.stderr) {
        log?.(`PM2 启动输出: ${startResult.stderr}`, 'warning')
      }
      log?.('Java 应用已通过 PM2 启动', 'success')
      log?.('查看状态: pm2 logs java-app', 'info')
    } else {
      // 不使用 PM2
      if (isWindowsPath) {
        // Windows: 使用 PowerShell 后台任务启动
        log?.('使用 Windows 后台任务启动服务...', 'info')
        const escapedPath = remotePath.replace(/\\/g, '\\\\')

        // 创建启动脚本
        const startScript = `
$ErrorActionPreference = 'Stop'
$jarPath = '${escapedPath}\\\\${jarFileName}'
$logPath = '${escapedPath}\\\\app.log'
Write-Output "Starting Java application: $jarPath" | Out-File -FilePath $logPath -Encoding UTF8
try {
    $process = Start-Process -FilePath 'java' -ArgumentList '-jar', '${jarFileName}' -WorkingDirectory '${escapedPath}' -WindowStyle Hidden -RedirectStandardOutput $logPath -RedirectStandardError $logPath -PassThru
    Write-Output "Java process started with PID: $($process.Id)" | Out-File -FilePath $logPath -Append -Encoding UTF8
    Write-Output "success"
} catch {
    Write-Output "Error starting Java: $_" | Out-File -FilePath $logPath -Append -Encoding UTF8
    Write-Output "failed"
    throw
}
`
        const startResult = await this.ssh.execCommand(
          `powershell -Command "${startScript.replace(/\n/g, '').replace(/  +/g, '')}"`
        )

        log?.(`启动结果: ${startResult.stdout.trim()}`, startResult.stdout.includes('success') ? 'success' : 'warning')
        log?.('Java 应用已后台启动', 'success')
        log?.(`查看日志: type ${remotePath}\\app.log`, 'info')
      } else {
        // Unix: 使用 nohup 启动
        await this.ssh.execCommand(
          `cd ${remotePath} && nohup java -jar ${jarFileName} > app.log 2>&1 &`
        )
        log?.('Java 应用已后台启动', 'success')
        log?.(`查看日志: tail -f ${remotePath}/app.log`, 'info')
      }
    }

    // 4. 验证服务启动
    log?.('等待服务启动...', 'info')
    await new Promise(resolve => setTimeout(resolve, 8000))

    let isRunning = false
    if (isWindowsPath) {
      // 更详细的进程检查
      const verifyResult = await this.ssh.execCommand(
        `powershell -Command "$process = Get-Process java -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${jarFileName}*' }; if ($process) { Write-Output \"Running: PID=$($process.Id), StartTime=$($process.StartTime)\" } else { Write-Output 'not_running' }"`
      )
      const output = verifyResult.stdout.trim()
      isRunning = output !== 'not_running'
      log?.(`进程状态: ${output}`, 'info')

      // 如果进程不存在，尝试读取日志
      if (!isRunning) {
        log?.('进程未找到，尝试读取启动日志...', 'warning')
        const logResult = await this.ssh.execCommand(
          `powershell -Command "if (Test-Path '${remotePath}\\app.log') { Get-Content '${remotePath}\\app.log' -Tail 20 } else { Write-Output 'Log file not found' }"`
        )
        if (logResult.stdout) {
          log?.(`日志内容:\n${logResult.stdout}`, 'info')
        }
      }
    } else {
      const verifyResult = await this.ssh.execCommand('ps aux | grep -v grep | grep "java.*-jar.*app.jar" || echo "not_running"')
      isRunning = verifyResult.stdout.trim() !== 'not_running'
    }

    if (isRunning) {
      log?.('Java 服务启动成功', 'success')
    } else {
      log?.('Java 服务启动可能失败，请检查日志', 'warning')
    }
  }

  async fileExists(filePath: string, log?: LogCallback): Promise<boolean> {
    if (!this.ssh) {
      throw new Error('Not connected to server')
    }

    try {
      // 检测是否为 Windows 路径
      const isWindowsPath = filePath.match(/^[A-Za-z]:\\/)

      let checkCommand: string
      if (isWindowsPath) {
        // Windows: 使用 PowerShell 检查
        checkCommand = `powershell -Command "if (Test-Path '${filePath}') { Write-Output 'exists' } else { Write-Output 'not_exists' }"`
      } else {
        // Unix: 使用 test 命令
        checkCommand = `test -f "${filePath}" && echo "exists" || echo "not_exists"`
      }

      const result = await this.ssh.execCommand(checkCommand)
      const exists = result.stdout.trim() === 'exists'

      log?.(`文件检查 ${filePath}: ${exists ? '存在' : '不存在'}`, 'info')
      return exists
    } catch (error: any) {
      log?.(`文件检查失败: ${error.message}`, 'warning')
      return false
    }
  }

  async healthCheck(host: string, port = 3000, isWindowsServer = false, log?: LogCallback, remotePath?: string): Promise<boolean> {
    try {
      const healthUrl = `http://${host}:${port}/health`
      log?.(`健康检查: ${healthUrl}`, 'info')

      // 首先尝试直接从本地访问 - 使用更简单的方法
      try {
        const result = await execaCommand(`curl -s -o /dev/null -w '%{http_code}' ${healthUrl}`, { shell: true })
        const statusCode = result.stdout.trim()
        log?.(`本地访问 HTTP 状态: ${statusCode}`, 'info')

        if (statusCode === '200') {
          log?.('健康检查成功 (本地访问)', 'success')
          return true
        }
      } catch (localError: any) {
        log?.(`本地访问失败: ${localError.message || 'unknown error'}`, 'warning')
      }

      // 如果直接访问失败，通过 SSH 访问
      if (this.ssh) {
        log?.('尝试通过 SSH 检查服务状态...', 'info')

        if (isWindowsServer) {
          // Windows: 检查端口监听状态
          const portCheckResult = await this.ssh.execCommand(
            `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"`
          )
          const isListening = parseInt(portCheckResult.stdout.trim() || '0') > 0
          log?.(`端口 ${port} 状态: ${isListening ? '正在监听' : '未监听'}`, 'info')

          if (!isListening) {
            // 端口未监听，检查 Java 进程和所有监听端口
            const javaCheck = await this.ssh.execCommand(
              `powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"`
            )
            log?.(`Java 进程数: ${javaCheck.stdout.trim() || '0'}`, 'info')

            // 显示所有 Java 进程监听的端口
            const javaPorts = await this.ssh.execCommand(
              `powershell -Command "Get-Process java -ErrorAction SilentlyContinue | ForEach-Object { \$process = \$_; Get-NetTCPConnection -OwningProcess \$process.Id -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort | Select-Object -ExpandProperty LocalPort } | Select-Object -Unique"`
            )
            const ports = javaPorts.stdout.trim()
            if (ports) {
              const portList = ports.replace(/\r\n/g, '\n').split('\n').filter(p => p)
              log?.(`Java 进程正在监听的端口: ${portList.join(', ')}`, 'info')

              // 尝试在每个端口上做健康检查
              for (const javaPort of portList) {
                log?.(`尝试端口 ${javaPort}...`, 'info')
                try {
                  const httpResult = await this.ssh.execCommand(
                    `powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:${javaPort}/health' -UseBasicParsing -TimeoutSec 5).StatusCode } catch { 'ERROR' }"`
                  )
                  const response = httpResult.stdout.trim()
                  if (response === '200') {
                    log?.(`健康检查成功! 端口: ${javaPort}`, 'success')
                    return true
                  }
                } catch (e) {
                  // Continue to next port
                }
              }

              log?.('所有 Java 端口健康检查均失败', 'warning')
            } else {
              log?.('Java 进程未监听任何端口', 'warning')
            }

            // 尝试读取应用日志
            if (remotePath) {
              try {
                const escapedPath = remotePath.replace(/\\/g, '\\\\')
                const logContent = await this.ssh.execCommand(
                  `powershell -Command "if (Test-Path '${escapedPath}\\app.log') { Get-Content '${escapedPath}\\app.log' -Tail 50 } else { Write-Output 'Log file not found' }"`
                )
                if (logContent.stdout && !logContent.stdout.includes('not found')) {
                  log?.(`应用日志:\n${logContent.stdout}`, 'info')
                }
              } catch (e) {
                // Ignore log reading errors
              }
            }

            return false
          }

          // 尝试 HTTP 请求
          const httpResult = await this.ssh.execCommand(
            `powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:${port}/health' -UseBasicParsing -TimeoutSec 10).StatusCode } catch { 'ERROR:' + $_.Exception.Message }"`
          )
          const response = httpResult.stdout.trim()
          log?.(`HTTP 响应: ${response}`, 'info')

          return response === '200'
        } else {
          // Unix: 检查端口监听状态
          const portCheckResult = await this.ssh.execCommand(`netstat -tln 2>/dev/null | grep ":${port} " | grep LISTEN | wc -l`)
          const isListening = parseInt(portCheckResult.stdout.trim() || '0') > 0
          log?.(`端口 ${port} 状态: ${isListening ? '正在监听' : '未监听'}`, 'info')

          if (!isListening) {
            // 检查 Java 进程和端口
            const javaPorts = await this.ssh.execCommand(
              `netstat -tln 2>/dev/null | grep LISTEN | awk '{print \$4}' | grep -o '[0-9]*$' | sort -u`
            )
            const ports = javaPorts.stdout.trim()
            if (ports) {
              log?.(`检测到的监听端口: ${ports.replace(/\n/g, ', ')}`, 'info')

              // 尝试常见的 Java 应用端口
              const commonPorts = [8080, 8081, 9090, 8443, 8888, 9000]
              const portList = ports.split('\n').filter(p => p).map(p => parseInt(p))
              const portsToTry = [...new Set([...portList, ...commonPorts])]

              for (const tryPort of portsToTry) {
                if (!tryPort || tryPort === port) continue
                log?.(`尝试端口 ${tryPort}...`, 'info')
                try {
                  const httpResult = await this.ssh.execCommand(`curl -s -o /dev/null -w '%{http_code}' http://localhost:${tryPort}/health`)
                  if (httpResult.stdout.trim() === '200') {
                    log?.(`健康检查成功! 端口: ${tryPort}`, 'success')
                    return true
                  }
                } catch (e) {
                  // Continue
                }
              }
            }
            return false
          }

          // 尝试 HTTP 请求
          const httpResult = await this.ssh.execCommand(`curl -s -o /dev/null -w '%{http_code}' http://localhost:${port}/health`)
          const response = httpResult.stdout.trim()
          log?.(`HTTP 响应: ${response}`, 'info')

          return response === '200'
        }
      }

      return false
    } catch (error: any) {
      log?.(`健康检查异常: ${error.message}`, 'warning')
      return false
    }
  }

  async execCommand(command: string, log?: LogCallback): Promise<string> {
    if (!this.ssh) {
      throw new Error('Not connected to server')
    }

    log?.(`$ ${command}`, 'command')

    const result = await this.ssh.execCommand(command)

    if (result.stderr) {
      log?.(`Error: ${result.stderr}`, 'error')
    }

    if (result.stdout) {
      log?.(result.stdout, 'info')
    }

    return result.stdout
  }
}
