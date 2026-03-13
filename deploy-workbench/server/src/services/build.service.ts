import { execa, execaCommand } from 'execa'
import { deleteAsync } from 'del'
import { readdir, stat, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { existsSync } from 'fs'
import crypto from 'crypto'

type LogCallback = (message: string, type?: 'info' | 'success' | 'warning' | 'error' | 'command') => void

type PackageManager =
  | 'pnpm' | 'npm' | 'yarn' | 'bun'
  | 'maven' | 'gradle' | 'gradlew'
  | 'pip' | 'poetry' | 'conda'
  | 'go' | 'composer' | 'bundler' | 'dotnet'
  | 'node-npm' | 'node-pnpm'

export class BuildService {
  private getCacheKey(projectUrl: string, branch: string): string {
    return crypto.createHash('md5').update(`${projectUrl}#${branch}`).digest('hex')
  }

  private getCacheDir(cacheKey: string): string {
    return join(tmpdir(), 'deploy-cache', cacheKey)
  }

  async cleanup(dir: string): Promise<void> {
    try {
      await deleteAsync(dir, { force: true })
    } catch (error: any) {
      console.error('Cleanup error:', error.message)
    }
  }

  async install(dir: string, packageManager: PackageManager, log?: LogCallback, cacheKey?: string): Promise<void> {
    const installCmd = this.getInstallCommand(packageManager)

    log?.(`正在安装依赖...`, 'info')
    log?.(`$ cd ${dir} && ${installCmd}`, 'command')

    // 检查缓存（仅对 Node.js 项目）
    if (cacheKey && (packageManager === 'npm' || packageManager === 'pnpm' || packageManager === 'yarn' || packageManager === 'bun')) {
      const cacheDir = this.getCacheDir(cacheKey)
      const nodeModulesCache = join(cacheDir, 'node_modules')

      if (existsSync(nodeModulesCache)) {
        log?.('发现依赖缓存，正在复制...', 'info')
        try {
          const targetNodeModules = join(dir, 'node_modules')
          await mkdir(dirname(targetNodeModules), { recursive: true })

          // 使用 robocopy (Windows) 或 cp -r (Unix) 复制目录
          if (process.platform === 'win32') {
            await execa('robocopy', [nodeModulesCache, targetNodeModules, '/E', '/NFL', '/NDL', '/NJH', '/NJS'], {
              reject: false
            })
          } else {
            await execa('cp', ['-r', nodeModulesCache, targetNodeModules])
          }
          log?.('依赖缓存复制完成', 'success')
          return
        } catch (error: any) {
          log?.(`缓存复制失败，将重新安装: ${error.message}`, 'warning')
        }
      }
    }

    try {
      // 实时输出安装进度
      const child = execa(installCmd, {
        cwd: dir,
        shell: true,
        buffer: false
      })

      // 监听 stdout
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          const output = data.toString()
          // 过滤掉进度条，只保留重要信息
          const lines = output.split('\n').filter((line: string) => {
            const trimmed = line.trim()
            if (!trimmed) return false

            // 过滤进度条
            if (trimmed.includes('→') || trimmed.includes('|') || trimmed.includes('│')) {
              return false
            }

            // 对于 Maven，显示下载进度
            if (packageManager === 'maven') {
              // 显示 "Downloading" 开头的行
              if (trimmed.startsWith('Downloading')) {
                return true
              }
              // 显示 "Downloaded" 开头的行
              if (trimmed.startsWith('Downloaded')) {
                return true
              }
              // 显示 BUILD SUCCESS 或 FAILURE
              if (trimmed.includes('BUILD SUCCESS') || trimmed.includes('BUILD FAILURE')) {
                return true
              }
              // 显示错误信息
              if (trimmed.includes('ERROR')) {
                return true
              }
              return false
            }

            return true
          })

          lines.forEach((line: string) => {
            if (line.trim()) log?.(line.trim(), 'info')
          })
        })
      }

      // 监听 stderr
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          const output = data.toString()
          if (output.trim()) {
            log?.(output.trim(), 'warning')
          }
        })
      }

      await child

      // 保存缓存（仅对 Node.js 项目）
      if (cacheKey && (packageManager === 'npm' || packageManager === 'pnpm' || packageManager === 'yarn' || packageManager === 'bun')) {
        const cacheDir = this.getCacheDir(cacheKey)
        const nodeModulesCache = join(cacheDir, 'node_modules')
        const sourceNodeModules = join(dir, 'node_modules')

        if (existsSync(sourceNodeModules)) {
          log?.('正在保存依赖缓存...', 'info')
          try {
            await mkdir(cacheDir, { recursive: true })
            if (process.platform === 'win32') {
              await execa('robocopy', [sourceNodeModules, nodeModulesCache, '/E', '/NFL', '/NDL', '/NJH', '/NJS'], {
                reject: false
              })
            } else {
              await execa('cp', ['-r', sourceNodeModules, nodeModulesCache])
            }
            log?.('依赖缓存已保存', 'success')
          } catch (error: any) {
            log?.(`缓存保存失败: ${error.message}`, 'warning')
          }
        }
      }

      log?.('依赖安装完成', 'success')
    } catch (error: any) {
      throw new Error(`Failed to install dependencies: ${error.message}`)
    }
  }

  async build(dir: string, packageManager: PackageManager, command: string, log?: LogCallback): Promise<void> {
    log?.(`正在构建项目...`, 'info')
    log?.(`$ cd ${dir} && ${command}`, 'command')

    try {
      const { stdout } = await execaCommand(command, {
        cwd: dir,
        shell: true
      })

      if (stdout && log) {
        // Filter out progress bars
        const lines = stdout.split('\n').filter((line: string) => {
          const trimmed = line.trim()
          // Filter Vite progress indicators
          if (trimmed.includes('building') && trimmed.includes('%')) {
            return !trimmed.includes('%') || ['0%', '25%', '50%', '75%', '100%'].some(p => trimmed.includes(p))
          }
          return !trimmed.includes('→') && !trimmed.includes('|') && !trimmed.includes('│')
        })
        lines.forEach((line: string) => {
          if (line.trim()) log?.(line.trim(), 'info')
        })
      }

      log?.('项目构建完成', 'success')

      // 检测并输出构建产物位置
      const buildOutput = await this.detectBuildOutput(dir, packageManager)
      if (buildOutput.length > 0) {
        log?.(`构建产物: ${buildOutput.join(', ')}`, 'info')
      }
    } catch (error: any) {
      throw new Error(`Failed to build project: ${error.message}`)
    }
  }

  private async detectBuildOutput(dir: string, packageManager: PackageManager): Promise<string[]> {
    const outputs: string[] = []

    try {
      switch (packageManager) {
        case 'maven':
        case 'gradle':
        case 'gradlew': {
          // Java 项目 - 查找 jar 文件
          const targetDir = join(dir, 'target')
          const buildLibsDir = join(dir, 'build/libs')

          try {
            // 检查 target 目录
            const targetFiles = await readdir(targetDir)
            const jars = targetFiles.filter(f => f.endsWith('.jar'))
            jars.forEach(jar => outputs.push(join('target', jar)))
          } catch {
            // target 目录不存在
          }

          try {
            // 检查 build/libs 目录
            const libFiles = await readdir(buildLibsDir)
            const jars = libFiles.filter(f => f.endsWith('.jar'))
            jars.forEach(jar => outputs.push(join('build/libs', jar)))
          } catch {
            // build/libs 目录不存在
          }
          break
        }
        case 'pnpm':
        case 'npm':
        case 'yarn':
        case 'bun':
        case 'node-npm':
        case 'node-pnpm': {
          // Node.js 项目 - 检查 .output、dist、build 目录
          for (const outputDir of ['.output', 'dist', 'build']) {
            try {
              await stat(join(dir, outputDir))
              outputs.push(outputDir)
              break
            } catch {
              // 目录不存在
            }
          }
          break
        }
        case 'go': {
          // Go 项目 - 检查可执行文件
          const files = await readdir(dir)
          const exeFiles = files.filter(f => {
            if (process.platform === 'win32') {
              return f.endsWith('.exe')
            }
            return !f.includes('.') && f !== 'node_modules'
          })
          exeFiles.forEach(exe => outputs.push(exe))
          break
        }
      }
    } catch (error) {
      // 检测失败，忽略
    }

    return outputs
  }

  getInstallCommand(packageManager: PackageManager): string {
    switch (packageManager) {
      // JavaScript/TypeScript
      case 'pnpm':
        return 'pnpm install --frozen-lockfile'
      case 'npm':
        return 'npm ci'
      case 'yarn':
        return 'yarn install --frozen-lockfile'
      case 'bun':
        return 'bun install'

      // Node.js
      case 'node-npm':
        return 'npm install'
      case 'node-pnpm':
        return 'pnpm install'

      // Java
      case 'maven':
        return 'mvn install -DskipTests'
      case 'gradle':
        return './gradlew build -x test'
      case 'gradlew':
        return 'gradlew.bat build -x test'

      // Python
      case 'pip':
        return 'pip install -r requirements.txt'
      case 'poetry':
        return 'poetry install'
      case 'conda':
        return 'conda env update'

      // Go
      case 'go':
        return 'go mod download'

      // PHP
      case 'composer':
        return 'composer install --no-dev'

      // Ruby
      case 'bundler':
        return 'bundle install'

      // .NET
      case 'dotnet':
        return 'dotnet restore'

      default:
        return 'npm install'
    }
  }

  async getProjectType(dir: string): Promise<string> {
    try {
      // Check for package.json
      const { stdout } = await execaCommand('cat package.json', { cwd: dir })
      const pkg = JSON.parse(stdout)

      if (pkg.dependencies?.nuxt) {
        return 'nuxt'
      }
      if (pkg.dependencies?.next) {
        return 'next'
      }
      if (pkg.dependencies?.vue) {
        return 'vue'
      }
      if (pkg.dependencies?.react) {
        return 'react'
      }

      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  async getBuildCommand(dir: string): Promise<string> {
    const { stdout } = await execaCommand('cat package.json', { cwd: dir })
    const pkg = JSON.parse(stdout)

    return pkg.scripts?.build || 'npm run build'
  }
}
