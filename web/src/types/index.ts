// 组件层只认这份契约，数据来自 public/data 下 repos-parser 生成的静态 JSON。

export interface Project {
  id: string;
  name: string;
  author: string;
  // 作者实名；GitHub 用户名是 author
  authorName?: string;
  major?: string;
  enrollmentYear?: number;
  authorAvatar: string;
  repo: string;
  // 仓库的 About，没写就是空字符串
  about: string;
  // 取 repos/<id>.md 正文 Features 之前的部分，只在卡片上显示
  description: string;
  tags: string[];
  category: string;
  githubUrl: string;
  demoUrl: string | null;
  stars: number;
  // 近 7 天新增 star；没有 token 时构建期拿不到，为 0
  starsGained7d?: number;
  forks: number;
  language: string;
  license: string;
  createdAt: string;
  updatedAt: string;
  // 被本站收录的日期（YYYY-MM-DD）
  addedAt?: string;
  // 详情页按需加载，列表接口不含该字段
  readmeHtml?: string;
}

export interface CountItem {
  name: string;
  count: number;
}

export interface AuthorItem extends CountItem {
  avatar?: string;
  realName?: string;
  // 取仓库 owner，比 front matter 里的 author 可靠
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

export type SortKey = 'heat' | 'stars' | 'updated' | 'name';
