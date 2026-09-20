/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 生产环境后端地址；本地开发默认通过 Vite 代理访问 3001 端口 */
  readonly VITE_API_BASE?: string;
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
