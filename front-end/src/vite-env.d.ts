/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端就绪后填写真实接口地址 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
