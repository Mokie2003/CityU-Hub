/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端接口地址；不配置时开发环境走同源 /api（Vite 反代到 127.0.0.1:3001），生产环境读静态数据 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
