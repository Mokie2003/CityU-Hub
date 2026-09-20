import type { Project } from '../types';

/** 从 GitHub 仓库接口补齐的字段 */
interface GithubRepoMeta {
  language: string;
  stars: number;
  forks: number;
}

const CACHE_KEY = 'cityu-hub:github-meta';
/** 缓存 6 小时，避免反复打 GitHub 匿名接口（每小时 60 次） */
const CACHE_TTL = 6 * 60 * 60 * 1000;
/** 单次最多补这么多仓库，其余等下次访问 */
const MAX_REQUESTS = 20;
const CONCURRENCY = 4;

type MetaCache = Record<string, { meta: GithubRepoMeta; at: number }>;

function readCache(): MetaCache {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? '{}') as MetaCache;
  } catch {
    return {};
  }
}

function writeCache(cache: MetaCache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 隐私模式 / 存储配额不足时忽略
  }
}

/** 取出 owner/repo，取不到返回 null */
function repoSlug(project: Project): string | null {
  if (project.repo && /^[^/\s]+\/[^/\s]+$/.test(project.repo)) {
    return project.repo.replace(/\.git$/, '');
  }
  const match = /github\.com\/([^/?#]+)\/([^/?#]+)/i.exec(project.githubUrl ?? '');
  if (!match) return null;
  return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
}

async function fetchRepoMeta(slug: string, signal?: AbortSignal): Promise<GithubRepoMeta | null> {
  const res = await fetch(`https://api.github.com/repos/${slug}`, {
    signal,
    headers: { accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    language?: string | null;
    stargazers_count?: number;
    forks_count?: number;
  };
  return {
    language: data.language ?? '',
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
  };
}

/**
 * 用 GitHub 仓库接口补齐语言与 stars。
 * 只补后端没给到的项目，结果写入 localStorage 缓存；失败（限流 / 断网 / 404）时
 * 返回 null，调用方保持原数据不变。
 */
export async function enrichProjectsWithGithub(
  projects: Project[],
  signal?: AbortSignal,
): Promise<Project[] | null> {
  try {
    const cache = readCache();
    const now = Date.now();
    const queue: Array<{ slug: string }> = [];
    const metas = new Map<string, GithubRepoMeta>();

    for (const project of projects) {
      const slug = repoSlug(project);
      if (!slug) continue;

      const cached = cache[slug];
      if (cached && now - cached.at < CACHE_TTL) {
        metas.set(slug, cached.meta);
        continue;
      }
      // 后端已经给出语言和 stars 的就不用再请求
      if (project.language && project.stars > 0) continue;
      if (queue.length >= MAX_REQUESTS || queue.some((item) => item.slug === slug)) continue;
      queue.push({ slug });
    }

    let stopped = false;
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length && !stopped) {
        const current = queue[cursor];
        cursor += 1;
        try {
          const meta = await fetchRepoMeta(current.slug, signal);
          if (!meta) continue;
          metas.set(current.slug, meta);
          cache[current.slug] = { meta, at: Date.now() };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          // 命中限流或网络异常，本轮不再继续请求
          stopped = true;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, worker),
    );

    if (queue.length > 0) writeCache(cache);
    if (metas.size === 0) return null;

    let changed = false;
    const merged = projects.map((project) => {
      const slug = repoSlug(project);
      const meta = slug ? metas.get(slug) : undefined;
      if (!meta) return project;
      const language = project.language || meta.language;
      const stars = meta.stars || project.stars;
      const forks = meta.forks || project.forks;
      if (language === project.language && stars === project.stars && forks === project.forks) {
        return project;
      }
      changed = true;
      return { ...project, language, stars, forks };
    });

    return changed ? merged : null;
  } catch {
    return null;
  }
}
