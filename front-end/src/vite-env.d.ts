/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选的 HTTP API 根地址；未配置时使用 public/data 静态数据 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
