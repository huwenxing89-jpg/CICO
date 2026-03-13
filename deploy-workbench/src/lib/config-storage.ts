/**
 * 配置存储服务 - 使用加密方式保护敏感信息
 */

const STORAGE_KEY = 'deploy-config-encrypted'
const ENCRYPTION_KEY = 'deploy-workbench-key-2024' // 在实际应用中应该使用更安全的方式管理密钥

// 简单的加密函数 (XOR + Base64)
function encrypt(text: string): string {
  if (!text) return ''
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
  }
  return btoa(result)
}

// 解密函数
function decrypt(encoded: string): string {
  if (!encoded) return ''
  try {
    const text = atob(encoded)
    let result = ''
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    }
    return result
  } catch {
    return ''
  }
}

interface StoredConfig {
  repoUrl: string
  branch: string
  branches: string[]
  server: {
    host: string
    port: number
    username: string
    password: string
    privateKey: string
    path: string
    restartPm2: boolean
  }
  build: {
    packageManager: string
    command: string
    localBuild: boolean
  }
  authMethod: 'password' | 'key'
}

interface EncryptedStoredConfig {
  repoUrl: string
  branch: string
  branches: string[]
  server: {
    host: string
    port: number
    username: string
    passwordEncrypted: string
    privateKeyEncrypted: string
    path: string
    restartPm2: boolean
  }
  build: {
    packageManager: string
    command: string
    localBuild: boolean
  }
  authMethod: 'password' | 'key'
}

// 保存配置
export function saveConfig(config: any, authMethod: 'password' | 'key', branches: string[] = []): void {
  const stored: EncryptedStoredConfig = {
    repoUrl: config.repoUrl || '',
    branch: config.branch || 'main',
    branches: branches,
    server: {
      host: config.server?.host || '',
      port: config.server?.port || 22,
      username: config.server?.username || 'root',
      passwordEncrypted: encrypt(config.server?.password || ''),
      privateKeyEncrypted: encrypt(config.server?.privateKey || ''),
      path: config.server?.path || '/var/www/app',
      restartPm2: config.server?.restartPm2 ?? true
    },
    build: {
      packageManager: config.build?.packageManager || 'pnpm',
      command: config.build?.command || 'pnpm run build',
      localBuild: config.build?.localBuild ?? true
    },
    authMethod
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch (error) {
    console.warn('Failed to save config:', error)
  }
}

// 加载配置
export function loadConfig(): StoredConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed: EncryptedStoredConfig = JSON.parse(stored)

    // 解密敏感信息
    return {
      repoUrl: parsed.repoUrl,
      branch: parsed.branch,
      branches: parsed.branches || [],
      server: {
        host: parsed.server.host,
        port: parsed.server.port,
        username: parsed.server.username,
        password: decrypt(parsed.server.passwordEncrypted),
        privateKey: decrypt(parsed.server.privateKeyEncrypted),
        path: parsed.server.path,
        restartPm2: parsed.server.restartPm2
      },
      build: {
        packageManager: parsed.build.packageManager,
        command: parsed.build.command,
        localBuild: parsed.build.localBuild
      },
      authMethod: parsed.authMethod
    }
  } catch (error) {
    console.warn('Failed to load config:', error)
    return null
  }
}

// 清除配置
export function clearConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear config:', error)
  }
}

// 检查是否有保存的配置
export function hasSavedConfig(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
}
