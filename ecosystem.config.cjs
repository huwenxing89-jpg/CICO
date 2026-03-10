/**
 * PM2 配置文件
 * 使用集群模式运行 Nuxt 3 应用
 */
module.exports = {
  apps: [{
    name: 'nuxt-app',
    script: './.output/server/index.mjs',

    // 集群模式：使用所有 CPU 核心
    instances: 'max',
    exec_mode: 'cluster',

    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },

    // 环境特定配置
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },

    env_staging: {
      NODE_ENV: 'production',
      PORT: 3001,
    },

    // 日志配置
    error_file: './logs/nuxt-error.log',
    out_file: './logs/nuxt-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // 进程管理
    max_memory_restart: '500M',
    min_uptime: '10s',
    autorestart: true,
    watch: false,

    // 优雅关闭
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }]
}
