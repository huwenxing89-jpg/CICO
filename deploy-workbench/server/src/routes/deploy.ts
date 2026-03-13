import { Router, Request, Response } from 'express'
import { tmpdir } from 'os'
import { join } from 'path'
import { SSHService } from '../services/ssh.service.js'
import { BuildService } from '../services/build.service.js'
import { GitService } from '../services/git.service.js'

export const deployRouter: Router = Router()

const sshService = new SSHService()
const buildService = new BuildService()
const gitService = new GitService()

interface DeployRequest {
  repoUrl: string
  branch: string
  server: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
    path: string
    restartPm2: boolean
  }
  build: {
    packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | 'maven' | 'gradle' | 'gradlew' | 'pip' | 'poetry' | 'conda' | 'go' | 'composer' | 'bundler' | 'dotnet' | 'node-npm' | 'node-pnpm'
    command: string
    localBuild: boolean
  }
}

// Deployment cancellation tracking
interface DeploymentContext {
  clientId: string
  cancelled: boolean
  tempDir?: string
  response: Response
}

const activeDeployments = new Map<string, DeploymentContext>()

// SSE connections for real-time logs
const clients = new Map<string, Response>()

function sendLog(clientId: string, message: string, type: 'info' | 'success' | 'warning' | 'error' | 'command' = 'info') {
  const client = clients.get(clientId)
  if (client && !client.writableEnded) {
    client.write(`data: ${JSON.stringify({ message, type, timestamp: Date.now() })}\n\n`)
  }
}

// Check if deployment is cancelled
function checkCancelled(context: DeploymentContext): boolean {
  if (context.cancelled) {
    sendLog(context.clientId, '部署已被取消', 'warning')
    return true
  }
  return false
}

// Check if path is Windows format
function isWindowsPath(path: string): boolean {
  return /^[A-Za-z]:\\/.test(path)
}

// Start deployment
deployRouter.post('/deploy', async (req: Request, res: Response) => {
  const config = req.body as DeployRequest
  const clientId = req.headers['x-client-id'] as string || Math.random().toString(36)

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Create deployment context
  const context: DeploymentContext = {
    clientId,
    cancelled: false,
    response: res
  }

  clients.set(clientId, res)
  activeDeployments.set(clientId, context)

  const log = (message: string, type: 'info' | 'success' | 'warning' | 'error' | 'command' = 'info') => {
    sendLog(clientId, message, type)
  }

  let tempDir = ''

  try {
    log('=== 开始部署流程 ===', 'info')
    log(`仓库: ${config.repoUrl}`, 'info')
    log(`分支: ${config.branch}`, 'info')
    log(`服务器: ${config.server.username}@${config.server.host}:${config.server.port}`, 'info')
    log(`构建模式: ${config.build.localBuild ? '本地构建后上传' : '服务器端构建'}`, 'info')

    if (config.build.localBuild) {
      // ========== 模式1: 本地构建后上传 ==========
      tempDir = join(tmpdir(), `deploy-${Date.now()}`)
      context.tempDir = tempDir

      // Check for cancellation before each step
      if (checkCancelled(context)) return

      // Step 1: Clone repository locally
      log('正在克隆仓库到本地...', 'info')
      await gitService.clone(config.repoUrl, config.branch, tempDir, log)

      if (checkCancelled(context)) return
      log('仓库克隆成功', 'success')

      // Step 2: Install dependencies locally
      log('正在本地安装依赖...', 'info')
      // 生成缓存键（基于仓库 URL 和分支）
      const cacheKey = `${config.repoUrl}#${config.branch}`
      await buildService.install(tempDir, config.build.packageManager, log, cacheKey)

      if (checkCancelled(context)) return
      log('依赖安装完成', 'success')

      // Step 3: Build project locally
      log('正在本地构建项目...', 'info')
      await buildService.build(tempDir, config.build.packageManager, config.build.command, log)

      if (checkCancelled(context)) return
      log('项目构建完成', 'success')

      // Step 4: Connect to server
      log('正在连接服务器...', 'info')
      await sshService.connect(config.server)

      if (checkCancelled(context)) return
      log('服务器连接成功', 'success')

      // 检测项目类型
      const isJavaProject = ['maven', 'gradle', 'gradlew'].includes(config.build.packageManager)

      // Step 5: Check if old app.jar exists, stop service if needed
      if (config.server.restartPm2 && isJavaProject) {
        const targetJarPath = isWindowsPath(config.server.path)
          ? `${config.server.path}\\app.jar`
          : `${config.server.path}/app.jar`

        const fileExists = await sshService.fileExists(targetJarPath, log)

        if (fileExists) {
          log('检测到旧的 app.jar，正在停止 Java 服务...', 'info')
          try {
            const isWin = isWindowsPath(config.server.path)
            // 先停止服务，释放 app.jar 文件锁定
            if (isWin) {
              await sshService.execCommand('powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like \'*app.jar*\' } | Stop-Process -Force -ErrorAction SilentlyContinue"')
              await sshService.execCommand('pm2 stop java-app 2>$null || echo "no_pm2"')
            } else {
              await sshService.execCommand('pm2 stop java-app 2>/dev/null || pkill -f "java.*-jar.*app.jar" || true')
            }
            await new Promise(resolve => setTimeout(resolve, 2000)) // 等待进程完全停止
            log('旧服务已停止', 'success')
          } catch (e) {
            log?.('停止服务警告: ' + (e as Error).message, 'warning')
          }
        } else {
          log('未检测到旧的 app.jar，首次部署', 'info')
        }
      }

      if (checkCancelled(context)) return

      // Step 6: Upload build output (now that the file is unlocked)
      log('正在上传构建产物...', 'info')
      await sshService.upload(tempDir, config.server.path, log)

      if (checkCancelled(context)) return
      log('文件上传完成', 'success')

      // Step 7: Start service
      log('正在启动服务...', 'info')
      if (config.server.restartPm2) {
        if (isJavaProject) {
          await sshService.restartJavaService(config.server.path, log)
        } else {
          await sshService.restartPm2(config.server.path, log)
        }
      }

      if (checkCancelled(context)) return
      log('服务部署完成', 'success')

      // Cleanup local temp directory
      await buildService.cleanup(tempDir)
    } else {
      // ========== 模式2: 服务器端构建 ==========
      if (checkCancelled(context)) return

      log('正在连接服务器...', 'info')
      await sshService.connect(config.server)

      if (checkCancelled(context)) return
      log('服务器连接成功', 'success')

      const remotePath = config.server.path

      // 检测项目类型
      const isJavaProject = ['maven', 'gradle', 'gradlew'].includes(config.build.packageManager)

      // Step 0: Stop service BEFORE building (to release file lock)
      if (config.server.restartPm2 && isJavaProject) {
        log('正在停止旧的 Java 服务...', 'info')
        try {
          const isWin = isWindowsPath(remotePath)
          if (isWin) {
            await sshService.execCommand('powershell -Command "Get-Process java -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like \'*app.jar*\' } | Stop-Process -Force -ErrorAction SilentlyContinue"')
            await sshService.execCommand('pm2 stop java-app 2>$null || echo "no_pm2"')
          } else {
            await sshService.execCommand('pm2 stop java-app 2>/dev/null || pkill -f "java.*-jar.*app.jar" || true')
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
          log('旧服务已停止', 'success')
        } catch (e) {
          log?.('停止服务警告: ' + (e as Error).message, 'warning')
        }
      }

      if (checkCancelled(context)) return

      // Step 1: Check if remote directory exists, clone or pull
      log('正在服务器上准备代码...', 'info')
      const checkDirCmd = `test -d ${remotePath}/.git && echo "exists" || echo "not_exists"`
      const dirExists = await sshService.execCommand(checkDirCmd, log)

      if (checkCancelled(context)) return

      if (dirExists.trim() === 'not_exists') {
        // Directory doesn't exist, clone repository
        log(`正在服务器上克隆仓库: ${remotePath}`, 'info')
        await sshService.execCommand(`git clone --depth 1 --branch ${config.branch} ${config.repoUrl} ${remotePath}`, log)
      } else {
        // Directory exists, fetch and pull
        log(`更新服务器上的代码...`, 'info')
        await sshService.execCommand(`cd ${remotePath} && git fetch origin && git checkout ${config.branch} && git pull origin ${config.branch}`, log)
      }

      if (checkCancelled(context)) return
      log('代码准备完成', 'success')

      // Step 2: Install dependencies on server
      log('正在服务器上安装依赖...', 'info')
      const installCmd = buildService.getInstallCommand(config.build.packageManager)
      await sshService.execCommand(`cd ${remotePath} && ${installCmd}`, log)

      if (checkCancelled(context)) return
      log('依赖安装完成', 'success')

      // Step 3: Build project on server
      log('正在服务器上构建项目...', 'info')
      await sshService.execCommand(`cd ${remotePath} && ${config.build.command}`, log)

      if (checkCancelled(context)) return
      log('项目构建完成', 'success')

      // Step 4: Start service
      log('正在启动服务...', 'info')
      if (config.server.restartPm2) {
        if (isJavaProject) {
          await sshService.restartJavaService(remotePath, log)
        } else {
          await sshService.restartPm2(remotePath, log)
        }
      }

      if (checkCancelled(context)) return
      log('服务部署完成', 'success')
    }

    // Step 5: Verify deployment
    if (!context.cancelled) {
      log('正在验证部署...', 'info')
      const isWin = isWindowsPath(config.server.path)
      const isHealthy = await sshService.healthCheck(config.server.host, 3000, isWin, log, config.server.path)
      if (isHealthy) {
        log('健康检查通过!', 'success')
        log('=== 部署成功! ===', 'success')
      } else {
        log('健康检查失败', 'error')
      }
    }

    // Cleanup
    await sshService.disconnect()

  } catch (error: any) {
    if (!context.cancelled) {
      log(`部署失败: ${error.message}`, 'error')
    }
    await sshService.disconnect()
  } finally {
    // Clean up temp directory if it exists
    if (tempDir) {
      try {
        await buildService.cleanup(tempDir)
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    clients.delete(clientId)
    activeDeployments.delete(clientId)

    if (!res.writableEnded) {
      res.end()
    }
  }
})

// Stop deployment
deployRouter.post('/stop', (req: Request, res: Response) => {
  const clientId = req.headers['x-client-id'] as string

  const context = activeDeployments.get(clientId)

  if (context) {
    // Mark deployment as cancelled
    context.cancelled = true

    // Send stop message
    sendLog(clientId, '正在停止部署...', 'warning')

    // Clean up temp directory if exists
    if (context.tempDir) {
      buildService.cleanup(context.tempDir).catch(() => {})
    }

    // Disconnect SSH if connected
    sshService.disconnect().catch(() => {})

    setTimeout(() => {
      clients.delete(clientId)
      activeDeployments.delete(clientId)
    }, 100)

    res.json({ success: true, message: '部署停止指令已发送' })
  } else {
    res.status(404).json({ error: 'Deployment not found' })
  }
})

// Get active deployments status
deployRouter.get('/status', (req: Request, res: Response) => {
  const statuses = Array.from(activeDeployments.entries()).map(([clientId, ctx]) => ({
    clientId,
    cancelled: ctx.cancelled,
    hasTempDir: !!ctx.tempDir
  }))
  res.json({ activeDeployments: statuses })
})
