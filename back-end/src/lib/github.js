const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const RESERVED_SEGMENTS = new Set([
  'tree', 'blob', 'blame', 'issues', 'pull', 'pulls', 'releases', 'actions', 'wiki',
  'commits', 'tags', 'archive', 'raw', 'edit', 'settings', 'compare', 'discussions',
  'projects', 'graphs', 'network', 'stargazers', 'watchers', 'forks', 'branches',
]);
const OWNER_REPO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function buildRef(ownerRaw, repoRaw, ref, subPath) {
  const owner = String(ownerRaw).trim();
  const repo = String(repoRaw ?? '').trim().replace(/\.git$/i, '').replace(/\/+$/, '');
  if (!owner || !repo || !OWNER_REPO_RE.test(owner) || !OWNER_REPO_RE.test(repo)) return null;
  return {
    owner,
    repo,
    repoUrl: `https://github.com/${owner}/${repo}`,
    ref: ref || null,
    subPath: subPath || '',
  };
}

export function parseRepoUrl(input) {
  if (typeof input !== 'string') return null;
  let raw = input.trim().replace(/[#?].*$/, '');
  if (!raw || raw.length > 2048) return null;

  const ssh = raw.match(/^git@([^:]+):(.+)$/i);
  if (ssh) {
    if (!GITHUB_HOSTS.has(ssh[1].toLowerCase())) return null;
    const segments = ssh[2].split('/');
    return segments.length === 2 ? buildRef(segments[0], segments[1], null, '') : null;
  }

  if (/^https?:\/\//i.test(raw)) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    if (segments.length > 2 && RESERVED_SEGMENTS.has(segments[2].toLowerCase())) {
      return buildRef(segments[0], segments[1], segments[3] ?? null, segments.slice(4).join('/'));
    }
    return buildRef(segments[0], segments[1], null, '');
  }

  const stripped = raw.replace(/^\/+/, '').split('/').filter(Boolean);
  if (stripped[0] && GITHUB_HOSTS.has(stripped[0].toLowerCase())) stripped.shift();
  return stripped.length === 2 ? buildRef(stripped[0], stripped[1], null, '') : null;
}

export function createGithubClient(config, { fetchImpl = globalThis.fetch } = {}) {
  async function request(url) {
    try {
      return await fetchImpl(url, {
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(config.githubToken ? { Authorization: `Bearer ${config.githubToken}` } : {}),
        },
        signal: AbortSignal.timeout(config.githubTimeoutMs),
      });
    } catch (error) {
      throw new Error(`访问 GitHub 失败：${error.message}`);
    }
  }

  return {
    async fetchRepoMeta(ref) {
      const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
      const response = await request(url);
      if (response.status === 403 || response.status === 429) {
        throw new Error('GitHub API 调用次数已达上限，请配置 GITHUB_TOKEN 后重试');
      }
      if (response.status === 404) throw new Error(`GitHub 上找不到仓库 ${ref.owner}/${ref.repo}`);
      if (!response.ok) throw new Error(`获取 GitHub 仓库信息失败（HTTP ${response.status}）`);

      const data = await response.json();
      if (data.private) throw new Error(`仓库 ${ref.owner}/${ref.repo} 是私有仓库`);
      return {
        repo: data.name ?? ref.repo,
        owner: data.owner?.login ?? ref.owner,
        authorAvatar: data.owner?.avatar_url ?? '',
        description: data.description ?? '',
        homepageUrl: data.homepage ?? '',
        language: data.language ?? '',
        topics: Array.isArray(data.topics) ? data.topics : [],
        stars: Number.isFinite(data.stargazers_count) ? data.stargazers_count : 0,
        forks: Number.isFinite(data.forks_count) ? data.forks_count : 0,
        pushedAt: data.pushed_at ?? null,
        license: data.license?.spdx_id ?? null,
        archived: Boolean(data.archived),
        defaultBranch: data.default_branch ?? 'main',
      };
    },
  };
}
