/**
 * PM2 金丝雀部署配置
 * 运行金丝雀版本的应用实例
 */
module.exports = {
  apps: [{
    name: 'nuxt-app-canary',
    script: './.output/server/index.mjs',

    // 金丝雀使用较少实例
    instances: 2,
    exec_mode: 'cluster',

    // 金丝雀环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3010,
      APP_VERSION: 'canary',
    },

    // 日志配置（使用不同文件）
    error_file: './logs/nuxt-canary-error.log',
    out_file: './logs/nuxt-canary-out.log',
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
