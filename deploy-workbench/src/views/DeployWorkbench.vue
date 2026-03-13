<template>
  <div class="min-h-screen p-4 md:p-6 lg:p-8">
    <!-- Header -->
    <header class="mb-8 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
          <Rocket class="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">DevOps 部署工作台</h1>
          <p class="text-sm text-muted-foreground">一体化构建部署管理平台</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Badge :variant="statusVariant" class="gap-1.5">
          <span class="h-2 w-2 animate-pulse rounded-full bg-current" />
          {{ statusText }}
        </Badge>
      </div>
    </header>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Left Column - Configuration -->
      <div class="space-y-6 lg:col-span-1">
        <!-- Repository Config -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Github class="h-5 w-5" />
              仓库配置
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label>仓库地址</Label>
              <Input
                v-model="config.repoUrl"
                placeholder="https://github.com/owner/repo.git"
                :disabled="isDeploying"
              />
            </div>
            <div class="space-y-2">
              <Label>分支</Label>
              <Select
                v-model="config.branch"
                :disabled="isDeploying || isLoadingBranches"
                :placeholder="isLoadingBranches ? '加载中...' : '选择分支'"
                :options="branches.map(b => ({ value: b, label: b }))"
              />
            </div>
            <Button
              variant="outline"
              class="w-full"
              :disabled="!config.repoUrl || isDeploying"
              @click="fetchBranches"
            >
              <RefreshCw :class="['h-4 w-4', isLoadingBranches && 'animate-spin']" />
              刷新分支
            </Button>
          </CardContent>
        </Card>

        <!-- Server Config -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Server class="h-5 w-5" />
              服务器配置
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label>服务器地址</Label>
              <Input
                v-model="config.server.host"
                placeholder="192.168.1.100 或 example.com"
                :disabled="isDeploying"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>SSH 端口</Label>
                <Input
                  v-model.number="config.server.port"
                  type="number"
                  :disabled="isDeploying"
                />
              </div>
              <div class="space-y-2">
                <Label>部署路径</Label>
                <Input
                  v-model="config.server.path"
                  placeholder="/var/www/app"
                  :disabled="isDeploying"
                />
              </div>
            </div>
            <div class="space-y-2">
              <Label>用户名</Label>
              <Input
                v-model="config.server.username"
                placeholder="root 或 deploy"
                :disabled="isDeploying"
              />
            </div>
            <div class="space-y-2">
              <Label>认证方式</Label>
              <Tabs v-model="authMethod" default-value="password">
                <TabsList class="w-full">
                  <TabsTrigger value="password" class="flex-1">密码</TabsTrigger>
                  <TabsTrigger value="key" class="flex-1">密钥</TabsTrigger>
                </TabsList>
                <TabsContent value="password" class="mt-2">
                  <Input
                    v-model="config.server.password"
                    type="password"
                    placeholder="SSH 密码"
                    :disabled="isDeploying"
                  />
                </TabsContent>
                <TabsContent value="key" class="mt-2">
                  <Textarea
                    v-model="config.server.privateKey"
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    class="font-mono text-xs"
                    :rows="4"
                    :disabled="isDeploying"
                  />
                </TabsContent>
              </Tabs>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="save-pm2" v-model="config.server.restartPm2" />
              <Label for="save-pm2" class="text-sm cursor-pointer select-none">部署后重启 PM2</Label>
            </div>
          </CardContent>
        </Card>

        <!-- Build Config -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Settings2 class="h-5 w-5" />
              构建配置
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label>包管理器</Label>
              <Select
                v-model="config.build.packageManager"
                :disabled="isDeploying"
                :options="packageManagerOptions"
                placeholder="选择包管理器"
              />
            </div>
            <div class="space-y-2">
              <Label>构建命令</Label>
              <Input
                v-model="config.build.command"
                placeholder="npm run build"
                :disabled="isDeploying"
              />
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="build-local" v-model="config.build.localBuild" />
              <Label for="build-local" class="text-sm cursor-pointer select-none">本地构建后上传</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Right Column - Deployment & Logs -->
      <div class="space-y-6 lg:col-span-2">
        <!-- Quick Actions -->
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap gap-3">
              <Button
                size="lg"
                :disabled="!canDeploy || isDeploying"
                @click="startDeploy"
              >
                <Rocket :class="['h-5 w-5', isDeploying && 'animate-pulse']" />
                {{ isDeploying ? '部署中...' : '开始部署' }}
              </Button>
              <Button
                size="lg"
                variant="outline"
                :disabled="!hasActiveDeployment"
                @click="stopDeploy"
              >
                <Square class="h-5 w-5" />
                停止部署
              </Button>
              <Button
                size="lg"
                variant="outline"
                :disabled="logs.length === 0"
                @click="clearLogs"
              >
                <Trash2 class="h-5 w-5" />
                清空日志
              </Button>
              <Button
                size="lg"
                variant="outline"
                :disabled="!config.server.host"
                @click="testConnection"
              >
                <Plug class="h-5 w-5" />
                测试连接
              </Button>
              <Button
                size="lg"
                variant="outline"
                :disabled="!hasSavedConfigFlag"
                @click="clearSavedConfig"
              >
                <Trash2 class="h-5 w-5" />
                清除配置
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Progress Steps -->
        <Card>
          <CardHeader>
            <CardTitle>部署进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div
                v-for="step in deploymentSteps"
                :key="step.id"
                class="flex items-start gap-3 p-3 rounded-lg transition-colors"
                :class="getStepClass(step)"
              >
                <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                  :class="getStepIconClass(step)">
                  <Check v-if="step.status === 'completed'" class="h-3.5 w-3.5" />
                  <Loader2 v-else-if="step.status === 'running'" class="h-3.5 w-3.5 animate-spin" />
                  <X v-else-if="step.status === 'error'" class="h-3.5 w-3.5" />
                  <span v-else class="text-xs font-semibold">{{ step.order + 1 }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <p class="font-medium">{{ step.name }}</p>
                    <span v-if="step.duration" class="text-xs text-muted-foreground">{{ step.duration }}</span>
                  </div>
                  <p v-if="step.message" class="text-sm text-muted-foreground truncate">{{ step.message }}</p>
                  <div v-if="step.status === 'running' && step.progress" class="mt-2">
                    <Progress :value="step.progress" class="h-1" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Terminal Log -->
        <Card class="flex-1">
          <CardHeader class="border-b">
            <div class="flex items-center justify-between">
              <CardTitle class="flex items-center gap-2">
                <Terminal class="h-5 w-5" />
                部署日志
              </CardTitle>
              <div class="flex items-center gap-2">
                <Badge variant="outline" class="font-mono text-xs">
                  {{ logs.length }} lines
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0"
                  @click="toggleAutoScroll"
                >
                  <ArrowDown :class="['h-4 w-4', autoScroll && 'text-primary']" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent class="p-0">
            <div
              ref="logContainer"
              class="h-96 overflow-y-auto bg-slate-950 p-4 font-mono text-sm text-slate-300 scrollbar-thin"
            >
              <div v-if="logs.length === 0" class="flex h-full items-center justify-center text-slate-500">
                <div class="text-center">
                  <Terminal class="mx-auto h-12 w-12 opacity-20" />
                  <p class="mt-2">点击"开始部署"查看日志</p>
                </div>
              </div>
              <div v-else>
                <div
                  v-for="(log, index) in logs"
                  :key="index"
                  class="log-line flex gap-2 py-0.5"
                  :class="getLogClass(log.type)"
                >
                  <span class="shrink-0 text-slate-500">{{ log.timestamp }}</span>
                  <span class="flex-1 whitespace-pre-wrap">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Deployment History -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <History class="h-5 w-5" />
              部署历史
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="history.length === 0" class="py-8 text-center text-muted-foreground">
              暂无部署记录
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(record, index) in history"
                :key="index"
                class="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-full"
                    :class="getStatusBgClass(record.status)"
                  >
                    <Check v-if="record.status === 'success'" class="h-4 w-4 text-white" />
                    <X v-else-if="record.status === 'error'" class="h-4 w-4 text-white" />
                    <Loader2 v-else class="h-4 w-4 text-white animate-spin" />
                  </div>
                  <div>
                    <p class="font-medium">{{ record.branch }}</p>
                    <p class="text-xs text-muted-foreground">{{ record.commit?.slice(0, 8) }}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-sm font-medium">{{ record.duration }}</p>
                  <p class="text-xs text-muted-foreground">{{ record.time }}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import { saveConfig, loadConfig, clearConfig } from '@/lib/config-storage'
import {
  Card, CardContent, CardHeader, CardTitle,
  Input, Label, Button, Badge, Progress, Textarea,
  Select, Tabs, TabsList, TabsTrigger, TabsContent, Checkbox
} from '@/components/ui'
import {
  Rocket, Server, Github, Settings2, Terminal, History,
  RefreshCw, Square, Trash2, Plug, ArrowDown,
  Check, X, Loader2
} from 'lucide-vue-next'

// Types
interface ServerConfig {
  host: string
  port: number
  username: string
  password: string
  privateKey: string
  path: string
  restartPm2: boolean
}

interface BuildConfig {
  packageManager: 'pnpm' | 'npm' | 'yarn'
  command: string
  localBuild: boolean
}

interface Config {
  repoUrl: string
  branch: string
  server: ServerConfig
  build: BuildConfig
}

interface Log {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'command'
}

interface DeploymentStep {
  id: string
  order: number
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  message?: string
  progress?: number
  duration?: string
}

interface HistoryRecord {
  branch: string
  commit?: string
  status: 'success' | 'error' | 'running'
  duration: string
  time: string
}

// State
const authMethod = ref<'password' | 'key'>('password')
const autoScroll = ref(true)
const logContainer = ref<HTMLElement>()

const config = reactive<Config>({
  repoUrl: '',
  branch: 'main',
  server: {
    host: '',
    port: 22,
    username: 'root',
    password: '',
    privateKey: '',
    path: '/var/www/app',
    restartPm2: true
  },
  build: {
    packageManager: 'pnpm',
    command: 'pnpm run build',  // 初始值也要匹配
    localBuild: true  // 默认在本地构建
  }
})

const branches = ref<string[]>(['main', 'develop', 'staging'])
const logs = ref<Log[]>([])
const history = ref<HistoryRecord[]>([])
const isLoadingBranches = ref(false)
const isDeploying = ref(false)
const deploymentStartTime = ref<number>()

// 包管理器选项
const packageManagerOptions = [
  // 前端 - JavaScript/TypeScript
  { value: 'pnpm', label: 'pnpm (推荐，快速)' },
  { value: 'npm', label: 'npm (标准)' },
  { value: 'yarn', label: 'Yarn (Facebook)' },
  { value: 'bun', label: 'Bun (新一代)' },
  // 后端 - Node.js
  { value: 'node-npm', label: 'Node.js + npm' },
  { value: 'node-pnpm', label: 'Node.js + pnpm' },
  // 后端 - Java
  { value: 'maven', label: 'Maven (Java)' },
  { value: 'gradle', label: 'Gradle (Java/Kotlin)' },
  { value: 'gradlew', label: 'Gradle Wrapper (Java)' },
  // 后端 - Python
  { value: 'pip', label: 'pip (Python)' },
  { value: 'poetry', label: 'Poetry (Python)' },
  { value: 'conda', label: 'Conda (Python 数据科学)' },
  // 后端 - Go
  { value: 'go', label: 'Go Modules' },
  // 后端 - PHP
  { value: 'composer', label: 'Composer (PHP)' },
  // 后端 - Ruby
  { value: 'bundler', label: 'Bundler (Ruby)' },
  // 后端 - .NET
  { value: 'dotnet', label: 'NuGet (.NET)' }
]

// 根据包管理器获取默认构建命令
const getDefaultBuildCommand = (packageManager: string): string => {
  const commands: Record<string, string> = {
    // 前端
    'pnpm': 'pnpm run build',
    'npm': 'npm run build',
    'yarn': 'yarn build',
    'bun': 'bun run build',
    // 后端 - Node.js
    'node-npm': 'npm run build',
    'node-pnpm': 'pnpm run build',
    // Java
    'maven': 'mvn clean package -DskipTests',
    'gradle': './gradlew clean build -x test',
    'gradlew': './gradlew clean build -x test',
    // Python
    'pip': 'pip install -r requirements.txt && python setup.py build',
    'poetry': 'poetry build',
    'conda': 'conda build',
    // Go
    'go': 'go build -o app',
    // PHP
    'composer': 'composer install && composer dump-autoload --optimize',
    // Ruby
    'bundler': 'bundle install && bundle exec jekyll build',
    // .NET
    'dotnet': 'dotnet build --configuration Release'
  }
  return commands[packageManager] || 'npm run build'
}

// 检查当前命令是否为默认命令
const isDefaultCommand = (command: string, packageManager: string): boolean => {
  const defaultCmd = getDefaultBuildCommand(packageManager)
  return command.trim() === defaultCmd
}

// 监听包管理器变化，自动更新构建命令
watch(() => config.build.packageManager, (newPackageManager, oldPackageManager) => {
  // 获取新包管理器的默认命令
  const newDefaultCommand = getDefaultBuildCommand(newPackageManager)

  // 检查旧命令是否为默认命令
  const oldCommand = config.build.command.trim()
  const wasDefault = oldPackageManager ? isDefaultCommand(oldCommand, oldPackageManager) : true

  // 如果旧命令是默认命令（或者是初始值），则更新为新默认命令
  if (wasDefault || oldCommand === 'npm run build' || oldCommand === 'pnpm run build') {
    config.build.command = newDefaultCommand
  }
}, { immediate: true })

const deploymentSteps = ref<DeploymentStep[]>([
  { id: 'validate', order: 0, name: '验证配置', status: 'pending' },
  { id: 'clone', order: 1, name: '克隆仓库', status: 'pending' },
  { id: 'install', order: 2, name: '安装依赖', status: 'pending' },
  { id: 'build', order: 3, name: '构建项目', status: 'pending' },
  { id: 'upload', order: 4, name: '上传文件', status: 'pending' },
  { id: 'deploy', order: 5, name: '部署服务', status: 'pending' },
  { id: 'verify', order: 6, name: '验证部署', status: 'pending' }
])

// Computed
const canDeploy = computed(() => {
  return config.repoUrl &&
         config.branch &&
         config.server.host &&
         config.server.username &&
         (authMethod.value === 'password' ? config.server.password : config.server.privateKey)
})

const hasActiveDeployment = computed(() => isDeploying.value)

const statusText = computed(() => {
  if (isDeploying.value) return '部署中'
  if (logs.value.length > 0) return '就绪'
  return '空闲'
})

const statusVariant = computed(() => {
  if (isDeploying.value) return 'default'
  if (logs.value.length > 0) return 'secondary'
  return 'outline'
})

// 配置缓存相关
const hasSavedConfigFlag = ref(false)

const clearSavedConfig = () => {
  clearConfig()
  hasSavedConfigFlag.value = false
  addLog('已清除保存的配置', 'warning')
}

// 组件挂载时加载配置
onMounted(() => {
  const saved = loadConfig()
  if (saved) {
    // 恢复配置
    if (saved.repoUrl) config.repoUrl = saved.repoUrl
    if (saved.branch) config.branch = saved.branch
    if (saved.branches && saved.branches.length > 0) {
      branches.value = saved.branches
    }
    if (saved.server) {
      if (saved.server.host) config.server.host = saved.server.host
      if (saved.server.port) config.server.port = saved.server.port
      if (saved.server.username) config.server.username = saved.server.username
      if (saved.server.password) config.server.password = saved.server.password
      if (saved.server.privateKey) config.server.privateKey = saved.server.privateKey
      if (saved.server.path) config.server.path = saved.server.path
      if (saved.server.restartPm2 !== undefined) config.server.restartPm2 = saved.server.restartPm2
    }
    if (saved.build) {
      if (saved.build.packageManager) config.build.packageManager = saved.build.packageManager as any
      if (saved.build.command) config.build.command = saved.build.command
      if (saved.build.localBuild !== undefined) config.build.localBuild = saved.build.localBuild
    }
    if (saved.authMethod) authMethod.value = saved.authMethod

    hasSavedConfigFlag.value = true
    addLog('已加载上次保存的配置', 'info')
  }
})

// 监听配置变化自动保存
watch(
  () => ({ ...config, authMethod: authMethod.value }),
  (newConfig) => {
    saveConfig(newConfig, authMethod.value, branches.value)
    hasSavedConfigFlag.value = true
  },
  { deep: true }
)

// Methods
const addLog = (message: string, type: Log['type'] = 'info') => {
  const now = new Date()
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  logs.value.push({ timestamp, message, type })

  if (autoScroll.value) {
    nextTick(() => {
      logContainer.value?.scrollTo({ top: logContainer.value.scrollHeight, behavior: 'smooth' })
    })
  }
}

const updateStep = (id: string, updates: Partial<DeploymentStep>) => {
  const step = deploymentSteps.value.find(s => s.id === id)
  if (step) {
    Object.assign(step, updates)
  }
}

const getStepClass = (step: DeploymentStep) => {
  switch (step.status) {
    case 'completed': return 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
    case 'running': return 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'
    case 'error': return 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
    default: return 'bg-muted/30'
  }
}

const getStepIconClass = (step: DeploymentStep) => {
  switch (step.status) {
    case 'completed': return 'border-green-500 text-green-500'
    case 'running': return 'border-blue-500 text-blue-500'
    case 'error': return 'border-red-500 text-red-500'
    default: return 'border-muted-foreground/30 text-muted-foreground'
  }
}

const getLogClass = (type: Log['type']) => {
  return `log-${type}`
}

const getStatusBgClass = (status: string) => {
  switch (status) {
    case 'success': return 'bg-green-500'
    case 'error': return 'bg-red-500'
    default: return 'bg-slate-500'
  }
}

const fetchBranches = async () => {
  isLoadingBranches.value = true
  addLog('正在获取分支列表...', 'info')
  try {
    const response = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: config.repoUrl })
    })
    const data = await response.json()
    if (data.branches) {
      branches.value = data.branches
      addLog(`成功获取 ${data.branches.length} 个分支`, 'success')
      // 保存分支列表
      saveConfig(config, authMethod.value, branches.value)
    }
  } catch (error) {
    addLog(`获取分支失败: ${error}`, 'error')
  } finally {
    isLoadingBranches.value = false
  }
}

const testConnection = async () => {
  addLog('正在测试服务器连接...', 'info')
  addLog(`服务器: ${config.server.username}@${config.server.host}:${config.server.port}`, 'info')

  try {
    const response = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.server.host,
        port: config.server.port,
        username: config.server.username,
        ...authMethod.value === 'password'
          ? { password: config.server.password }
          : { privateKey: config.server.privateKey }
      })
    })

    if (!response.ok) {
      addLog(`API 请求失败: HTTP ${response.status}`, 'error')
      return
    }

    const data = await response.json()
    if (data.success) {
      addLog('✓ 服务器连接成功!', 'success')
      addLog('SSH 认证通过，可以正常部署', 'success')
    } else {
      addLog(`✗ 连接失败: ${data.error}`, 'error')
      addLog('请检查服务器地址、端口、用户名和密码/密钥是否正确', 'warning')
    }
  } catch (error: any) {
    addLog(`✗ 连接测试失败: ${error.message || error}`, 'error')
    addLog('请确保后端服务正在运行 (http://localhost:3000)', 'warning')
  }
}

const startDeploy = async () => {
  if (!canDeploy.value) return

  isDeploying.value = true
  deploymentStartTime.value = Date.now()
  logs.value = []

  // Reset steps
  deploymentSteps.value.forEach(step => {
    step.status = 'pending'
    step.message = ''
    step.progress = 0
  })

  try {
    // 生成唯一的客户端 ID
    const clientId = Math.random().toString(36)

    // 准备部署请求数据
    const deployRequest = {
      repoUrl: config.repoUrl,
      branch: config.branch,
      server: {
        host: config.server.host,
        port: config.server.port,
        username: config.server.username,
        ...(authMethod.value === 'password'
          ? { password: config.server.password }
          : { privateKey: config.server.privateKey }
        ),
        path: config.server.path,
        restartPm2: config.server.restartPm2
      },
      build: {
        packageManager: config.build.packageManager,
        command: config.build.command,
        localBuild: config.build.localBuild
      }
    }

    // 使用 fetch 发送 POST 请求，直接接收 SSE 流
    const response = await fetch('/api/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': clientId
      },
      body: JSON.stringify(deployRequest)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // 读取 SSE 流
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('Response body is not readable')
    }

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      // 解码数据
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue

        try {
          const jsonStr = line.replace('data: ', '').trim()
          const data = JSON.parse(jsonStr)
          const { message, type, timestamp } = data

          // 添加日志
          const time = new Date(timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
          logs.value.push({ timestamp: time, message, type })

          // 自动滚动
          if (autoScroll.value) {
            nextTick(() => {
              logContainer.value?.scrollTo({ top: logContainer.value.scrollHeight, behavior: 'smooth' })
            })
          }

          // 更新部署步骤状态
          if (message.includes('克隆')) {
            if (type === 'success') updateStep('clone', { status: 'completed' })
            else if (type === 'info') updateStep('clone', { status: 'running' })
          } else if (message.includes('依赖') || message.includes('install')) {
            if (type === 'success') updateStep('install', { status: 'completed' })
            else if (type === 'info') updateStep('install', { status: 'running' })
          } else if (message.includes('构建') || message.includes('build')) {
            if (type === 'success') updateStep('build', { status: 'completed' })
            else if (type === 'info') updateStep('build', { status: 'running' })
          } else if (message.includes('上传')) {
            if (type === 'success') updateStep('upload', { status: 'completed' })
            else if (type === 'info') updateStep('upload', { status: 'running' })
          } else if (message.includes('部署服务') || message.includes('PM2')) {
            if (type === 'success') updateStep('deploy', { status: 'completed' })
            else if (type === 'info') updateStep('deploy', { status: 'running' })
          } else if (message.includes('健康检查') || message.includes('验证')) {
            if (type === 'success') updateStep('verify', { status: 'completed' })
            else if (type === 'info') updateStep('verify', { status: 'running' })
          }

          // 检查是否完成
          if (message.includes('部署成功')) {
            const duration = formatDuration(Date.now() - (deploymentStartTime.value || Date.now()))
            history.value.unshift({
              branch: config.branch,
              commit: Math.random().toString(16).slice(2, 10),
              status: 'success',
              duration,
              time: new Date().toLocaleString('zh-CN')
            })
            isDeploying.value = false
            return
          } else if (message.includes('部署失败')) {
            isDeploying.value = false
            deploymentSteps.value.forEach(step => {
              if (step.status === 'running') step.status = 'error'
            })
            return
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

  } catch (error) {
    addLog(`部署失败: ${error}`, 'error')
    isDeploying.value = false
  }
}

const stopDeploy = () => {
  isDeploying.value = false
  addLog('=== 部署已停止 ===', 'warning')
}

const clearLogs = () => {
  logs.value = []
}

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
}

// Utilities
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const simulateProgress = async (stepId: string, duration: number) => {
  const step = deploymentSteps.value.find(s => s.id === stepId)
  const interval = 50
  const steps = duration / interval

  for (let i = 0; i <= steps; i++) {
    if (step) step.progress = (i / steps) * 100
    await sleep(interval)
  }
}

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}
</script>
