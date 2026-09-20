import type { Project, ProjectsResponse } from '../types';

/** 后端 API 默认地址（见 back-end/src/server.mjs，可用 PORT / HOST 修改） */
const DEFAULT_DEV_API = 'http://127.0.0.1:3001';

/**
 * 数据来源：
 * 1. 配置了 VITE_API_BASE（例如部署后的后端）→ 走真实接口；
 * 2. 开发环境未配置 → 默认连本地 back-end（http://127.0.0.1:3001）；
 * 3. 生产构建且未配置 → 留空，直接读打包进 public/data 的静态数据。
 *
 * 无论走哪条路径，返回给组件的都是同一份数据契约，接口不可用时自动回退到静态数据。
 */
const API_BASE = (
  import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? DEFAULT_DEV_API : '')
).replace(/\/+$/, '');

/** 静态兜底数据（GitHub Pages 上没有后端进程时使用） */
const MOCK_URL = `${import.meta.env.BASE_URL}data/projects.json`;

let mockCache: ProjectsResponse | null = null;

async function loadStatic(): Promise<ProjectsResponse> {
  if (mockCache) return mockCache;
  const res = await fetch(MOCK_URL);
  if (!res.ok) {
    throw new Error(`静态项目数据加载失败（${res.status}）`);
  }
  mockCache = (await res.json()) as ProjectsResponse;
  return mockCache;
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`接口请求失败（${res.status} ${res.statusText}）`);
  }
  return (await res.json()) as T;
}

/** 首屏列表不需要 readme 正文，去掉后能显著减小传输与内存占用 */
function toSummary(project: Project): Project {
  const summary: Project = { ...project };
  delete summary.readmeHtml;
  return summary;
}

/** 项目列表 + 聚合信息（标签 / 作者 / 分类） */
export async function fetchProjects(): Promise<ProjectsResponse> {
  if (API_BASE) {
    try {
      const data = await request<ProjectsResponse>('/projects');
      return { ...data, projects: (data.projects ?? []).map(toSummary) };
    } catch (error) {
      console.warn('[cityu-hub] 后端接口不可用，已回退到静态数据：', error);
    }
  }
  const data = await loadStatic();
  return { ...data, projects: data.projects.map(toSummary) };
}

/** 项目详情（包含 readmeHtml） */
export async function fetchProjectById(id: string): Promise<Project> {
  if (API_BASE) {
    try {
      return await request<Project>(`/projects/${encodeURIComponent(id)}`);
    } catch (error) {
      console.warn('[cityu-hub] 后端接口不可用，已回退到静态数据：', error);
    }
  }
  const data = await loadStatic();
  const found = data.projects.find((project) => project.id === id);
  if (!found) {
    throw new Error(`未找到项目：${id}`);
  }
  return found;
}
