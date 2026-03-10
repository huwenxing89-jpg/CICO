/**
 * Prometheus 指标端点
 * 暴露应用和业务指标用于监控
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()

  // 获取应用运行时信息
  const uptime = process.uptime()
  const memoryUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()

  // 生成 Prometheus 格式的指标
  const metrics = [
    // 应用信息
    `# HELP app_info Application information`,
    `# TYPE app_info gauge`,
    `app_info{version="${config.runtimeConfig.appVersion as string}",environment="${
      config.runtimeConfig.public.appEnv
    }"} 1`,

    '',
    `# HELP app_uptime_seconds Application uptime in seconds`,
    `# TYPE app_uptime_seconds gauge`,
    `app_uptime_seconds ${uptime.toFixed(2)}`,

    '',
    `# HELP app_memory_usage_bytes Process memory usage in bytes`,
    `# TYPE app_memory_usage_bytes gauge`,
    `app_memory_usage_bytes{type="rss"} ${memoryUsage.rss}`,
    `app_memory_usage_bytes{type="heap_total"} ${memoryUsage.heapTotal}`,
    `app_memory_usage_bytes{type="heap_used"} ${memoryUsage.heapUsed}`,
    `app_memory_usage_bytes{type="external"} ${memoryUsage.external}`,

    '',
    `# HELP app_cpu_usage_total Process CPU usage in microseconds`,
    `# TYPE app_cpu_usage_seconds counter`,
    `app_cpu_usage_total{type="user"} ${cpuUsage.user}`,
    `app_cpu_usage_total{type="system"} ${cpuUsage.system}`,

    '',
    `# HELP http_requests_total Total number of HTTP requests`,
    `# TYPE http_requests_total counter`,
    `http_requests_total{status="2xx"} 0`,
    `http_requests_total{status="3xx"} 0`,
    `http_requests_total{status="4xx"} 0`,
    `http_requests_total{status="5xx"} 0`,

    '',
    `# HELP http_request_duration_seconds HTTP request latency`,
    `# TYPE http_request_duration_seconds histogram`,
    `http_request_duration_seconds_bucket{le="0.005"} 0`,
    `http_request_duration_seconds_bucket{le="0.01"} 0`,
    `http_request_duration_seconds_bucket{le="0.025"} 0`,
    `http_request_duration_seconds_bucket{le="0.05"} 0`,
    `http_request_duration_seconds_bucket{le="0.1"} 0`,
    `http_request_duration_seconds_bucket{le="0.25"} 0`,
    `http_request_duration_seconds_bucket{le="0.5"} 0`,
    `http_request_duration_seconds_bucket{le="1"} 0`,
    `http_request_duration_seconds_bucket{le="2.5"} 0`,
    `http_request_duration_seconds_bucket{le="5"} 0`,
    `http_request_duration_seconds_bucket{le="10"} 0`,
    `http_request_duration_seconds_bucket{le="+Inf"} 0`,
    `http_request_duration_seconds_sum 0`,
    `http_request_duration_seconds_count 0`,

    '',
    `# HELP deployment_info Deployment information`,
    `# TYPE deployment_info gauge`,
    `deployment_info{version="${config.runtimeConfig.appVersion as string}",deployed_at="${new Date().toISOString()}"} 1`,

    '',
    `# HELP dora_deployment_frequency Daily deployment count (DORA metric)`,
    `# TYPE dora_deployment_frequency gauge`,
    `dora_deployment_frequency 0`,

    '',
    `# HELP dora_change_failure_rate Deployment failure rate (DORA metric)`,
    `# TYPE dora_change_failure_rate gauge`,
    `dora_change_failure_rate 0`,

    '',
    `# HELP dora_lead_time_minutes Time from commit to deploy in minutes (DORA metric)`,
    `# TYPE dora_lead_time_minutes gauge`,
    `dora_lead_time_minutes 0`,

    '',
    `# HELP dora_mttr_minutes Mean time to restore in minutes (DORA metric)`,
    `# TYPE dora_mttr_minutes gauge`,
    `dora_mttr_minutes 0`,
  ]

  setHeader(event, 'content-type', 'text/plain; version=0.0.4')
  return metrics.join('\n')
})
