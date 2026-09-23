import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { aggregateProjects } from './lib/aggregate.js';
import { createGithubClient, parseRepoUrl } from './lib/github.js';
import { analyzeReadme, extractIntroduction, fillProjectContent, guessTagsFromReadme } from './lib/markdown.js';
import { slugify } from './lib/slug.js';
import { loadConfig } from './config.js';
import { parseFrontmatterDocument } from './lib/frontmatter.js';

const parserRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(parserRoot, '..');
const reposDir = path.resolve(process.env.REPOS_DIR ?? path.join(projectRoot, 'repos'));
/** 直接产出到 web 的静态资源目录，前端 npm run build 时会一起打包 */
const outputDir = path.resolve(process.env.OUTPUT_DIR ?? path.join(projectRoot, 'web', 'public', 'data'));
const offline = process.argv.includes('--offline');

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** 去掉脚本、内联事件与 javascript: 链接，README 渲染结果只保留安全的 HTML */
function scrubHtml(html) {
  return html
    .replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|form)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

/** Markdown 转成 HTML */
export function renderReadmeHtml(markdown) {
  return scrubHtml(String(marked.parse(markdown ?? '')));
}

function canonicalRepoUrl(url) {
  return url.toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '');
}

function toDate(value, fallback) {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : fallback;
}

/**
 * 读取上次产物的 addedAt 沿承下来。被本站收录的日期 GitHub 上没有，
 * 只能自己记，否则每天重建都会把老项目算成今天新增；首次构建读不到就返回空表。
 */
async function readPreviousAddedAt(outputPath) {
  try {
    const raw = await fs.readFile(path.join(outputPath, 'projects.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const entries = (parsed.projects ?? [])
      .map((project) => [project.id, project.addedAt])
      .filter(([, addedAt]) => typeof addedAt === 'string' && addedAt);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

/**
 * 把一个 repos/<id>.md 解析成前端契约（web/src/types/index.ts 里的 Project）。
 * 联网补齐（限流 / 404 / 断网）失败只告警不抛出，缺的字段由 md 正文和前端兜底。
 */
async function buildProject(meta, content, fileName, github, useOffline, fileDate, resolveAddedAt) {
  const ref = parseRepoUrl(meta.repoUrl);
  if (!ref) throw new Error(`${fileName}: repoUrl 不是可识别的 GitHub 仓库地址`);

  let githubMeta = null;
  if (!useOffline) {
    try {
      githubMeta = await github.fetchRepoMeta(ref);
    } catch (error) {
      console.warn(`[build-index] ${fileName}: 获取仓库信息失败，跳过联网补齐 —— ${error.message}`);
    }
  }

  // 近 7 天涨星：判断「最近是不是有人关注」，需要 token 才有 starred_at
  let starsGained7d = 0;
  if (!useOffline && githubMeta) {
    try {
      starsGained7d = (await github.fetchStarsGained(ref)) ?? 0;
    } catch (error) {
      console.warn(`[build-index] ${fileName}: 读取近 7 天涨星失败 —— ${error.message}`);
    }
  }

  const featuresHeading = content.match(/^\s{0,3}##\s+Features\s*#*\s*$/im);
  const intro = featuresHeading ? content.slice(0, featuresHeading.index) : content;
  let fetchedReadme = '';
  if (!intro.trim() && !useOffline) {
    try {
      fetchedReadme = await github.fetchReadme(ref);
    } catch (error) {
      console.warn(`[build-index] ${fileName}: 读取 README 失败，跳过回退 —— ${error.message}`);
    }
  }
  const enrichedContent = fillProjectContent(content, { readme: fetchedReadme });

  const analysis = analyzeReadme(enrichedContent);
  // 摘要只取介绍部分，避免把 Features 列表当成卡片简介
  const summary = analyzeReadme(extractIntroduction(enrichedContent)).summary;
  const tags = [
    ...new Set([
      ...meta.tags,
      ...(githubMeta?.topics ?? []),
      ...guessTagsFromReadme(enrichedContent, { language: githubMeta?.language }),
    ]),
  ].slice(0, 12);

  const id = meta.id || slugify(`${ref.owner}-${ref.repo}`);

  return {
    id,
    name: meta.title || analysis.title || githubMeta?.repo || ref.repo,
    author: meta.author || githubMeta?.owner || ref.owner,
    authorName: meta.authorName,
    major: meta.major,
    enrollmentYear: meta.enrollmentYear,
    authorAvatar: githubMeta?.authorAvatar ?? '',
    repo: `${ref.owner}/${ref.repo}`,
    about: githubMeta?.description ?? '',
    description: meta.summary || summary || '',
    tags,
    category: meta.category,
    githubUrl: ref.repoUrl,
    demoUrl: meta.homepageUrl || githubMeta?.homepageUrl || null,
    stars: githubMeta?.stars ?? 0,
    starsGained7d,
    forks: githubMeta?.forks ?? 0,
    language: githubMeta?.language ?? '',
    license: githubMeta?.license ?? '',
    createdAt: toDate(githubMeta?.createdAt, fileDate),
    updatedAt: toDate(githubMeta?.pushedAt, fileDate),
    /** 被本站收录的日期；GitHub 上没有这个概念，靠上一次的产物沿承 */
    addedAt: resolveAddedAt(id),
    status: meta.status,
    readmeHtml: renderReadmeHtml(enrichedContent),
  };
}

export async function buildIndex({ inputDir = reposDir, outputPath = outputDir, useOffline = offline, githubClient } = {}) {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_template.md')
    .map((entry) => entry.name)
    .sort();
  const config = loadConfig();
  // 只在需要自建客户端时提醒；测试会注入 mock，不必打扰
  let github = githubClient;
  if (!github) {
    if (!useOffline && !config.githubToken) {
      console.warn(
        '[build-index] 未配置 GITHUB_TOKEN，将走匿名接口（60 次/小时/IP，容易限流）；建议配置后再构建',
      );
    }
    github = createGithubClient(config);
  }
  const projects = [];
  const ids = new Map();
  const repoUrls = new Map();
  // 上一次的产物：把 addedAt 沿承下来（GitHub 上没有「什么时候被本站收录」这个信息）
  const previousAddedAt = await readPreviousAddedAt(outputPath);
  const today = new Date().toISOString().slice(0, 10);

  for (const fileName of files) {
    const filePath = path.join(inputDir, fileName);
    const source = await fs.readFile(filePath, 'utf8');
    const { meta, body } = parseFrontmatterDocument(source, fileName);
    // 离线构建拿不到 GitHub 的 pushed_at，用文档自身的时间兜底
    const fileDate = (await fs.stat(filePath)).mtime.toISOString().slice(0, 10);
    const project = await buildProject(
      meta,
      body,
      fileName,
      github,
      useOffline,
      fileDate,
      (projectId) => previousAddedAt.get(projectId) ?? today,
    );

    const repoKey = canonicalRepoUrl(project.githubUrl);
    if (ids.has(project.id)) throw new Error(`${fileName}: id 与 ${ids.get(project.id)} 重复`);
    if (repoUrls.has(repoKey)) throw new Error(`${fileName}: repoUrl 与 ${repoUrls.get(repoKey)} 重复`);
    ids.set(project.id, fileName);
    repoUrls.set(repoKey, fileName);
    projects.push(project);
  }

  // status: hidden 的文档不参与展示，也不进任何聚合
  const visible = projects.filter((project) => project.status !== 'hidden');
  const aggregates = aggregateProjects(visible);

  await fs.rm(outputPath, { recursive: true, force: true });
  // 列表文件保持轻量，正文 HTML 只放在 projects/<id>.json
  await writeJson(path.join(outputPath, 'projects.json'), {
    generatedAt: new Date().toISOString(),
    total: visible.length,
    projects: visible.map(({ readmeHtml, status, ...project }) => project),
    tags: aggregates.tags,
    authors: aggregates.authors,
    categories: aggregates.categories,
  });

  for (const { readmeHtml, status, ...project } of visible) {
    await writeJson(path.join(outputPath, 'projects', `${project.id}.json`), { ...project, readmeHtml });
  }

  return { projects: visible, outputDir: outputPath, aggregates };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildIndex()
    .then(({ projects, outputDir }) => {
      console.log(`Built ${projects.length} project(s) from ${reposDir}`);
      console.log(`Output: ${outputDir}`);
      if (offline) console.log('GitHub enrichment: skipped (--offline)');
    })
    .catch((err) => {
      console.error(`[build-index] ${err.message}`);
      process.exitCode = 1;
    });
}
