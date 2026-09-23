/**
 * 数据契约对应的 TS 类型定义。
 * 数据来自 public/data 下由 repos-parser 生成的静态 JSON，组件层只认这份契约。
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
  /** GitHub 仓库的 About，仓库没写就是空字符串；卡片与详情页的简介都用它 */
  about: string;
  /** 项目介绍（repos/<id>.md 正文中 Features 之前的部分）摘要，只用于卡片 */
  description: string;
  tags: string[];
  category: string;
  githubUrl: string;
  demoUrl: string | null;
  stars: number;
  /** 近 7 天新增的 star；没有 token 时构建期拿不到，为 0 */
  starsGained7d?: number;
  forks: number;
  language: string;
  license: string;
  createdAt: string;
  updatedAt: string;
  /** 被本站收录的日期（YYYY-MM-DD），由构建产物沿承 */
  addedAt?: string;
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
  /** 主页要跳的 GitHub 账号：取自仓库 owner，比 front matter 里的 author 可靠 */
  githubUser?: string;
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
export type SortKey = 'heat' | 'stars' | 'updated' | 'name';
