/**
 * 数据契约对应的 TS 类型定义。
 * 后端就绪后此文件的类型无需改动，只需把 api 层的 USE_MOCK 置为 false。
 */

export interface Project {
  id: string;
  name: string;
  author: string;
  authorName?: string;
  major?: string;
  enrollmentYear?: number;
  authorAvatar: string;
  repo: string;
  description: string;
  tags: string[];
  category: string;
  githubUrl: string;
  demoUrl: string | null;
  stars: number;
  forks: number;
  language: string;
  license: string;
  createdAt: string;
  updatedAt: string;
  /** 详情页按需加载，列表接口返回的数据中不包含该字段 */
  readmeHtml?: string;
}

export interface CountItem {
  name: string;
  count: number;
}

export interface ProjectsResponse {
  generatedAt: string;
  total: number;
  projects: Project[];
  tags: CountItem[];
  authors: CountItem[];
  categories: CountItem[];
}

/** 搜索接口的排序方式 */
export type SortKey = 'stars' | 'updated' | 'name';

export interface SearchIndexEntry {
  id: string;
  /** name */
  n: string;
  /** author */
  a: string;
  /** description */
  d: string;
  /** tags */
  t: string[];
  /** category */
  c: string;
}

export interface SearchIndexResponse {
  generatedAt: string;
  total: number;
  entries: SearchIndexEntry[];
}
