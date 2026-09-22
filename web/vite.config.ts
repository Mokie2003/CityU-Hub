import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** 前端端口固定 5173，被占用时直接报错，不自动漂移 */
const FRONTEND_PORT = 5173

/**
 * 允许用域名访问 dev / preview：Vite 的 DNS 重绑定保护默认只放行 localhost 与 IP 地址，
 * 用域名（例如 cityu-hub.cloud-ip.cc）访问时必须显式列出；前缀点号表示放行其所有子域名。
 */
const ALLOWED_HOSTS = ['cityu-hub.cloud-ip.cc', '.cloud-ip.cc']

export default defineConfig(({ mode }) => {
  // 部署在子路径（例如 GitHub Pages 的 /CityU-Hub/）时设置 BASE_PATH，默认部署在域名根路径
  const env = loadEnv(mode, '.', 'BASE_PATH')

  return {
    base: env.BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    server: {
      // host: true 监听 0.0.0.0，可用域名或服务器 IP 访问
      host: true,
      port: FRONTEND_PORT,
      strictPort: true,
      allowedHosts: ALLOWED_HOSTS,
    },
    preview: {
      host: true,
      port: FRONTEND_PORT,
      strictPort: true,
      allowedHosts: ALLOWED_HOSTS,
    },
  }
})
