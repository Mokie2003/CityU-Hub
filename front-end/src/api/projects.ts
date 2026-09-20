import type { Project, ProjectsResponse } from '../types';

/** 后端就绪后改为 false，并配置 VITE_API_BASE */
const USE_MOCK = true;

const MOCK_URL = `${import.meta.env.BASE_URL}data/projects.json`;
const API_BASE = import.meta.env.VITE_API_BASE;

let cache: ProjectsResponse | null = null;

async function loadMock(): Promise<ProjectsResponse> {
  if (cache) return cache;
  const res = await fetch(MOCK_URL);
  if (!res.ok) {
    throw new Error(`项目数据加载失败（${res.status}）`);
  }
  cache = (await res.json()) as ProjectsResponse;
  return cache;
}

/** 首屏列表不需要 readme 正文，去掉后能显著减小传输与内存占用 */
function toSummary(project: Project): Project {
  const summary: Project = { ...project };
  delete summary.readmeHtml;
  return summary;
}

/** 项目列表 + 聚合信息（标签 / 作者 / 分类） */
export async function fetchProjects(): Promise<ProjectsResponse> {
  if (USE_MOCK) {
    const data = await loadMock();
    return { ...data, projects: data.projects.map(toSummary) };
  }
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) {
    throw new Error(`项目数据加载失败（${res.status}）`);
  }
  return (await res.json()) as ProjectsResponse;
}

/** 项目详情（包含 readmeHtml） */
export async function fetchProjectById(id: string): Promise<Project> {
  if (USE_MOCK) {
    const data = await loadMock();
    const found = data.projects.find((project) => project.id === id);
    if (!found) {
      throw new Error(`未找到项目：${id}`);
    }
    return found;
  }
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`项目详情加载失败（${res.status}）`);
  }
  return (await res.json()) as Project;
}
