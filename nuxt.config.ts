// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  future: {
    compatibilityVersion: 4,
  },

  // 运行时配置
  runtimeConfig: {
    // 服务端私有环境变量
    appVersion: '',
    appEnv: '',

    // 公共环境变量（暴露给客户端）
    public: {
      appEnv: 'development',
      appUrl: 'http://localhost:3000',
    }
  },

  // 开发服务器配置
  devServer: {
    port: 3000,
  }
})
