import simpleGit, { SimpleGit } from 'simple-git'
import { execaCommand } from 'execa'

type LogCallback = (message: string, type?: 'info' | 'success' | 'warning' | 'error' | 'command') => void

export class GitService {
  private getRepoName(url: string): string {
    return url.split('/').pop()?.replace('.git', '') || 'repo'
  }

  async validateRepo(url: string): Promise<boolean> {
    try {
      await execaCommand(`git ls-remote ${url}`)
      return true
    } catch {
      return false
    }
  }

  async getBranches(url: string): Promise<string[]> {
    try {
      // 添加超时控制，防止命令卡住
      const result = await execaCommand(`git ls-remote --heads ${url}`, {
        timeout: 30000, // 30 秒超时
        env: {
          GIT_TERMINAL_PROMPT: '0',
          GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=10'
        }
      })

      const branches = result.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/refs\/heads\/(.+)$/)
          return match ? match[1] : null
        })
        .filter((branch): branch is string => branch !== null)

      return branches
    } catch (error: any) {
      if (error.killed || error.timedOut) {
        throw new Error('获取分支超时，请检查网络连接或稍后重试')
      }
      throw new Error(`获取分支失败: ${error.message}`)
    }
  }

  async getRepoInfo(url: string): Promise<{ name: string; defaultBranch: string }> {
    try {
      const result = await execaCommand(`git ls-remote --symref ${url} HEAD`)
      const match = result.stdout.match(/refs\/heads\/(.+)\s+HEAD/)
      const defaultBranch = match ? match[1] : 'main'

      return {
        name: this.getRepoName(url),
        defaultBranch
      }
    } catch (error: any) {
      throw new Error(`Failed to get repo info: ${error.message}`)
    }
  }

  async clone(url: string, branch: string, targetDir: string, log?: LogCallback): Promise<void> {
    try {
      const git = simpleGit()

      log?.(`正在克隆仓库: ${url}`, 'info')
      log?.(`$ git clone -b ${branch} ${url} ${targetDir}`, 'command')

      await git.clone(url, targetDir, ['--branch', branch, '--single-branch'])

      log?.('仓库克隆成功', 'success')
    } catch (error: any) {
      throw new Error(`Failed to clone repository: ${error.message}`)
    }
  }

  async getLatestCommit(dir: string): Promise<{ hash: string; message: string; author: string }> {
    try {
      const git = simpleGit(dir)
      const log = await git.log({ maxCount: 1 })

      return {
        hash: log.latest?.hash || '',
        message: log.latest?.message || '',
        author: log.latest?.author_name || ''
      }
    } catch (error: any) {
      throw new Error(`Failed to get commit info: ${error.message}`)
    }
  }

  async pull(dir: string, branch: string, log?: LogCallback): Promise<void> {
    try {
      const git = simpleGit(dir)

      log?.(`正在拉取最新代码...`, 'info')
      log?.(`$ git pull origin ${branch}`, 'command')

      await git.pull('origin', branch)

      log?.('代码拉取成功', 'success')
    } catch (error: any) {
      throw new Error(`Failed to pull: ${error.message}`)
    }
  }
}
