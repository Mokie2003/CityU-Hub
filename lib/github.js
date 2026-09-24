/**
 * 站点提交接口用的 GitHub 写端客户端。
 *
 * 和 repos-parser/src/lib/github.js 不是一回事：那个是构建时匿名读元数据的，
 * 这里的每个调用都要带 token，用来建分支、写文件、开 PR，只在 serverless 函数里跑。
 * 请求地址可用 GITHUB_API_URL 覆盖，测试里指向本地假服务。
 */
import { randomBytes } from 'node:crypto';

/** 必须和 web/src/constants/repo.ts 里的 REPO_URL 指向同一个仓库 */
const OWNER = 'Warpshlczy';
const REPO = 'CityU-Hub';
/** 项目一律提到 feature 分支，再由 feature-to-main 工作流合入 main */
const BASE_BRANCH = 'feature';
/** 提交分支的前缀，方便在分支列表里一眼认出是站点开的 */
const BRANCH_PREFIX = 'submit/';

const TIMEOUT_MS = 12_000;

/** 带错误码，调用方据此决定是回退到 GitHub 原生流程还是报错 */
export class GithubError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'GithubError';
    this.code = code;
    this.status = status;
  }
}

/** 没配 token 就用不了，返回 null 让接口整体降级 */
export function githubWriteConfig() {
  const token = process.env.SUBMIT_GITHUB_TOKEN;
  if (!token) return null;
  return { token, api: (process.env.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/+$/, '') };
}

async function request(config, method, path, body) {
  const res = await fetch(`${config.api}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'CityU-Hub-Submit/1.0',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

function repoPath(suffix = '') {
  return `/repos/${OWNER}/${REPO}${suffix}`;
}

/** GitHub 的错误响应里 message 最有用，拿不到就退回状态码 */
function reason(response) {
  return response.data?.message ? `${response.data.message}（HTTP ${response.status}）` : `HTTP ${response.status}`;
}

/**
 * 以站点身份往 feature 分支开一个 PR：建临时分支 → 写文件 → 开 PR。
 * 中途失败会把刚建的分支删掉，不在仓库里留空分支。
 * @returns {Promise<{url: string, number: number, branch: string}>}
 */
export async function openSubmitPullRequest(config, { slug, content, title, body }) {
  const base = await request(config, 'GET', repoPath(`/git/ref/heads/${BASE_BRANCH}`));
  if (base.status === 404) {
    throw new GithubError('base-branch-missing', `仓库里没有 ${BASE_BRANCH} 分支`, 500);
  }
  if (!base.ok) throw new GithubError('github-error', `读取 ${BASE_BRANCH} 分支失败：${reason(base)}`);

  // 不覆盖已存在的路径：同名文件基本都是同一个项目重复提交
  const filePath = `repos/${slug}.md`;
  const existing = await request(config, 'GET', repoPath(`/contents/${filePath}?ref=${BASE_BRANCH}`));
  if (existing.ok) {
    throw new GithubError('file-exists', `${filePath} 已经存在，可能已经收录过了`, 409);
  }
  if (existing.status !== 404) throw new GithubError('github-error', `检查文件失败：${reason(existing)}`);

  const branch = `${BRANCH_PREFIX}${slug}-${randomBytes(3).toString('hex')}`;
  const created = await request(config, 'POST', repoPath('/git/refs'), {
    ref: `refs/heads/${branch}`,
    sha: base.data.object.sha,
  });
  if (!created.ok) throw new GithubError('github-error', `创建分支失败：${reason(created)}`);

  try {
    const written = await request(config, 'POST', repoPath(`/contents/${filePath}`), {
      message: title,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
    });
    if (!written.ok) throw new GithubError('github-error', `写入文件失败：${reason(written)}`);

    const pr = await request(config, 'POST', repoPath('/pulls'), {
      title,
      head: branch,
      base: BASE_BRANCH,
      body,
    });
    if (!pr.ok) throw new GithubError('github-error', `创建 PR 失败：${reason(pr)}`);

    return { url: pr.data.html_url, number: pr.data.number, branch };
  } catch (error) {
    await request(config, 'DELETE', repoPath(`/git/refs/heads/${branch}`)).catch(() => {});
    throw error;
  }
}

export { BASE_BRANCH, OWNER, REPO };