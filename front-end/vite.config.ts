import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** 前端端口固定 5173，被占用时直接报错，不自动漂移 */
const FRONTEND_PORT = 5173

/** 后端接口（back-end）默认监听地址 */
const API_TARGET = 'http://127.0.0.1:3001'

/**
 * 允许用域名访问 dev / preview：Vite 的 DNS 重绑定保护默认只放行 localhost 与 IP 地址，
 * 用域名（例如 cityu-hub.cloud-ip.cc）访问时必须显式列出；前缀点号表示放行其所有子域名。
 */
const ALLOWED_HOSTS = ['cityu-hub.cloud-ip.cc', '.cloud-ip.cc']

/**
 * 由 Vite 反向代理接口：浏览器只访问前端端口，
 * 这样用域名或服务器 IP 访问时都无需直连 3001，也没有跨域问题。
 */
const apiProxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

export default defineConfig(({ command }) => ({
  // 构建产物部署在 GitHub Pages 的子路径下，开发环境仍从根路径访问
  base: command === 'build' ? '/CityU-Hub/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    // host: true 监听 0.0.0.0，可用域名或服务器 IP 访问
    host: true,
    port: FRONTEND_PORT,
    strictPort: true,
    allowedHosts: ALLOWED_HOSTS,
    proxy: apiProxy,
  },
  preview: {
    host: true,
    port: FRONTEND_PORT,
    strictPort: true,
    allowedHosts: ALLOWED_HOSTS,
    proxy: apiProxy,
  },
}))
