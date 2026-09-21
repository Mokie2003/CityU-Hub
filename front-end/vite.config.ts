import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** 前端端口固定 5173，被占用时直接报错，不自动漂移 */
const FRONTEND_PORT = 5173

/** 后端接口（back-end）默认监听地址 */
const API_TARGET = 'http://127.0.0.1:3001'

/**
 * 由 Vite 反向代理接口：浏览器只访问前端端口，
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
    
    host: true,
    port: FRONTEND_PORT,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    host: true,
    port: FRONTEND_PORT,
    strictPort: true,
    proxy: apiProxy,
  },
}))
