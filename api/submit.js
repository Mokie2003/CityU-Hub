/**
 * POST /api/submit —— 由本站直接往 feature 分支开 PR，提交者不必先 fork 仓库。
 *
 * 内容在前端已经校验过一遍，这里是第二道：文件名、体积、front matter 的必填项。
 * 完整的 schema 校验仍然交给 CI（npm run validate），PR 也要人工过一遍才合并，
 * 所以这里只拦明显不合法的输入。
 *
 * 没配 SUBMIT_GITHUB_TOKEN、或没配限流用的 Redis 时返回 submit-disabled，
 * 前端会退回「跳 GitHub 自己提交」的老流程，功能不会整块失效。
 */
import { createHash } from 'node:crypto';
import { GithubError, githubWriteConfig, openSubmitPullRequest } from '../lib/github.js';
import { readJsonBody, redisPipeline, resultAt, upstashConfig } from '../lib/upstash.js';

/** 正文按字符数限，JSON 转义后的字节数由这个上限兜住 */
const MAX_BODY_BYTES = 64 * 1024;
const MAX_CONTENT_CHARS = 12_000;
/** 与前端 toRepoFileName 的字符集一致，且不允许 / 与 .. 出现，免得跳到别的路径 */
const FILE_RE = /^repos\/[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5.-]{0,79}\.md$/;
/** 单 IP 每小时最多开这么多 PR */
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 3600;

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
const REQUIRED_FIELDS = ['title', 'author', 'authorName', 'major', 'enrollmentYear', 'repoUrl'];

/**
 * 只取顶层标量。front matter 是扁平的，为这点事把 yaml 解析器塞进 serverless
 * bundle 不划算；真正的 schema 校验在 CI 里用 js-yaml 跑。
 */
function readFrontmatter(content) {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const entry = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
    if (entry) fields[entry[1]] = entry[2].trim().replace(/^["']|["']$/g, '');
  }
  return fields;
}

/** 返回第一条错误文案，没问题时返回 null */
function validateSubmission(fileName, content) {
  if (!FILE_RE.test(fileName)) return '文件名不合法，需要是 repos/<项目名>.md';
  if (!content.trim()) return '内容为空';
  if (content.length > MAX_CONTENT_CHARS) return `内容不能超过 ${MAX_CONTENT_CHARS} 个字符`;

  const fields = readFrontmatter(content);
  if (!fields) return '内容缺少 YAML front matter（文件开头需要 ---）';
  const missing = REQUIRED_FIELDS.filter((key) => !fields[key]);
  if (missing.length > 0) return `front matter 缺少 ${missing.join('、')}`;

  if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+/.test(fields.repoUrl)) {
    return 'repoUrl 必须是 https://github.com/owner/repo 形式';
  }
  const year = Number(fields.enrollmentYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return 'enrollmentYear 必须是 2000–2100 之间的整数';
  }
  return null;
}

function prTitle(fields) {
  return `feat(repos): 新增项目 ${fields.title}`;
}

function prBody(fields, fileName) {
  return [
    '由 [CityU Hub](https://cityu-hub.bond) 的网页表单提交，不需要提交者本人 fork 仓库。',
    '',
    `- 项目：${fields.title}`,
    `- 提交者：${fields.authorName}（@${fields.author}）`,
    `- 专业：${fields.major}，${fields.enrollmentYear} 级`,
    `- 仓库：${fields.repoUrl}`,
    `- 新增文件：\`${fileName}\``,
    '',
    '> 表单里的 GitHub 用户名由提交者自行填写，本站无法核实其身份，合并前请一并确认。',
    '',
    '合并后由 feature-to-main 工作流同步进 main，网站随之更新。',
  ].join('\n');
}

/** 限流键里不放明文 IP，做法与 api/track.js 保持一致 */
function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string' && forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress ?? 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }

  // 没有 Redis 就限不了流，宁可不提供这个写入接口，也不要放一个不设防的出来
  const github = githubWriteConfig();
  if (!github || !upstashConfig()) {
    res.status(200).json({ ok: false, error: 'submit-disabled' });
    return;
  }

  const body = await readJsonBody(req, MAX_BODY_BYTES);
  const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
  const content = typeof body?.content === 'string' ? body.content : '';

  const problem = validateSubmission(fileName, content);
  if (problem) {
    res.status(400).json({ ok: false, error: 'invalid-submission', message: problem });
    return;
  }

  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const rateKey = `rate:submit:${clientKey(req)}:${bucket}`;
  try {
    const payload = await redisPipeline([
      ['INCR', rateKey],
      ['EXPIRE', rateKey, RATE_WINDOW_SECONDS],
    ]);
    if (Number(resultAt(payload, 0, 0)) > RATE_LIMIT) {
      res.status(429).json({ ok: false, error: 'rate-limited', message: '提交得太频繁了，请过一小时再试' });
      return;
    }
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: 'rate-limit-unavailable',
      message: `提交服务暂时不可用，请稍后再试（${error.message}）`,
    });
    return;
  }

  const fields = readFrontmatter(content);
  const slug = fileName.slice('repos/'.length, -'.md'.length);

  try {
    const pr = await openSubmitPullRequest(github, {
      slug,
      content,
      title: prTitle(fields),
      body: prBody(fields, fileName),
    });
    res.status(201).json({ ok: true, url: pr.url, number: pr.number });
  } catch (error) {
    const known = error instanceof GithubError;
    console.error(`[submit] ${fileName} 开 PR 失败：${error.message}`);
    res.status(known ? error.status : 502).json({
      ok: false,
      error: known ? error.code : 'github-unavailable',
      message: known ? error.message : '提交失败，请稍后重试',
    });
  }
}