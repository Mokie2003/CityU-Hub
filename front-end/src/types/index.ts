/**
 * 数据契约对应的 TS 类型定义。
 * 前端只认这份契约：数据可以来自 back-end 的 /projects 接口，
 * 也可以来自 public/data 下的静态 JSON，组件层无需区分。
 */

export interface Project {
  id: string;
  name: string;
  author: string;
  /** 作者实名（GitHub 用户名为 author） */
  authorName?: string;
  /** 专业 */
  major?: string;
  /** 入学年份 */
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

/** 侧栏作者榜用：在计数之外补上 GitHub 头像与作者实名 */
export interface AuthorItem extends CountItem {
  avatar?: string;
  realName?: string;
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
