import type { Project, ProjectsResponse } from '../types';

const MOCK_URL = `${import.meta.env.BASE_URL}data/projects.json`;
const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, '');

let cache: ProjectsResponse | null = null;

function countValues(projects: Project[], field: keyof Project) {
  const counts = new Map<string, number>();
  for (const project of projects) {
    const value = project[field];
    if (typeof value !== 'string' || !value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function toProject(value: Record<string, unknown>): Project {
  if ('name' in value) return value as unknown as Project;
  return {
    id: String(value.id ?? ''),
    name: String(value.title ?? value.id ?? ''),
    author: String(value.author ?? ''),
    authorName: typeof value.authorName === 'string' ? value.authorName : undefined,
    major: typeof value.major === 'string' ? value.major : undefined,
    enrollmentYear: typeof value.enrollmentYear === 'number' ? value.enrollmentYear : undefined,
    authorAvatar: `https://github.com/${String(value.author ?? '')}.png`,
    repo: String(value.repoUrl ?? ''),
    description: String(value.summary ?? value.description ?? ''),
    tags: Array.isArray(value.tags) ? value.tags.map(String) : [],
    category: String(value.category ?? 'other'),
    githubUrl: String(value.repoUrl ?? ''),
    demoUrl: typeof value.homepageUrl === 'string' && value.homepageUrl ? value.homepageUrl : null,
    stars: typeof value.stars === 'number' ? value.stars : 0,
    forks: typeof value.forks === 'number' ? value.forks : 0,
    language: String(value.language ?? ''),
    license: typeof value.license === 'string' ? value.license : '',
    createdAt: String(value.createdAt ?? ''),
    updatedAt: String(value.updatedAt ?? ''),
  };
}

async function readOptionalJson<T>(url: string, fallback: T): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return fallback;
  return (await res.json()) as T;
}

async function loadMock(): Promise<ProjectsResponse> {
  if (cache) return cache;
  const res = await fetch(MOCK_URL);
  if (!res.ok) {
    throw new Error(`静态项目数据不存在：${MOCK_URL}（${res.status}）`);
  }
  const raw = (await res.json()) as ProjectsResponse | Array<Record<string, unknown>>;
  if (!Array.isArray(raw)) {
    cache = raw;
    return cache;
  }

  const projects = raw.map(toProject);
  const dataUrl = `${import.meta.env.BASE_URL}data/`;
  cache = {
    generatedAt: new Date().toISOString(),
    total: projects.length,
    projects,
    tags: await readOptionalJson(`${dataUrl}tags.json`, countValues(projects, 'tags')),
    authors: await readOptionalJson(`${dataUrl}authors.json`, countValues(projects, 'author')),
    categories: await readOptionalJson(`${dataUrl}categories.json`, countValues(projects, 'category')),
  };
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
  if (!API_BASE) {
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
  if (!API_BASE) {
    const data = await loadMock();
    const found = data.projects.find((project) => project.id === id);
    if (!found) {
      throw new Error(`未找到项目：${id}`);
    }
    const detailUrl = `${import.meta.env.BASE_URL}data/projects/${encodeURIComponent(id)}.json`;
    const detail = await readOptionalJson<Record<string, unknown> | null>(detailUrl, null);
    return detail ? toProject(detail) : found;
  }
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`项目详情加载失败（${res.status}）`);
  }
  return (await res.json()) as Project;
}
