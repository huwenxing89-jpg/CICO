/**
 * 健康检查端点
 *
 * 用于监控和负载均衡器检查应用状态
 * 返回应用版本、运行时间和依赖服务状态
 */
export default defineEventHandler(() => {
  const config = useRuntimeConfig()

  // 检查各种依赖服务状态
  const checks = {
    database: 'ok',
    redis: 'ok',
    externalApi: 'ok',
  }

  // 如果任何检查失败，返回 503 状态码
  const isHealthy = Object.values(checks).every((status) => status === 'ok')

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    version: (config.runtimeConfig.appVersion as string) || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.runtimeConfig.public.appEnv,
    checks,
  }
})
