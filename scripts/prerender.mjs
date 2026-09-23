#!/usr/bin/env node
/**
 * 预渲染：把打包好的单页应用「展开」成每个路由一份静态 HTML，供搜索引擎收录。
 *
 * 为什么需要它：站点是 Vite 打包的 SPA，最初用 HashRouter，所有项目共用同一个 URL，
 * 爬虫眼里全站只有一页。改用 History 路由后每个项目有了真实地址，但如果只靠前端
 * 渲染，未执行 JS 的爬虫仍然什么都读不到。这里在构建期把每个项目的 head 标签与
 * 正文写进静态 HTML：爬虫拿到的就是成品页面，用户侧的 React 加载后会接管渲染。
 *
 * 产物（写入 web/dist）：
 *   index.html                  首页 head + JSON-LD
 *   project/<id>/index.html     每个项目一份，含 title / description / canonical /
 *                               OG / JSON-LD（SoftwareSourceCode）与可爬正文
 *   sitemap.xml  robots.txt     给爬虫的入口清单
 *
 * 数据来源是解析器已产出的 public/data/*.json，所以必须在 vite build 之后运行。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const webDir = path.join(projectRoot, 'web');
const distDir = path.resolve(process.env.OUTPUT_DIR ?? path.join(webDir, 'dist'));
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(webDir, 'public', 'data'));
/** 与 web/src/utils/seo.ts 里的 SITE_ORIGIN 保持一致 */
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://cityu-hub.bond';
/** 部署在子路径时才需要改（默认部署在域名根路径） */
const BASE_PATH = (process.env.BASE_PATH ?? '/').replace(/\/+$/, '');
const SITE_NAME = 'CityU Hub';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** 截断到指定长度，避免 meta description 过长被搜索引擎丢弃 */
function clamp(value, max = 150) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** readmeHtml → 纯文本，用于给爬虫一段可索引的正文 */
function htmlToText(html, max = 2400) {
  const text = String(html ?? '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 粗略估算文本宽度：CJK 按 1em，其余按 0.62em，够画徽章用 */
function textWidth(text, fontSize) {
  let units = 0;
  for (const ch of text) units += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.62;
  return Math.round(units * fontSize);
}

/**
 * 生成 shields 风格徽章 SVG。文字只用 ASCII 与 ★ —— GitHub 的 camo 用 librsvg 渲染，
 * 未必带中文字体，写中文会变成方框。
 */
function badgeSvg({ label, message }) {
  const fontSize = 11;
  const pad = 10;
  const height = 20;
  const labelW = textWidth(label, fontSize) + pad * 2;
  const messageW = textWidth(message, fontSize) + pad * 2;
  const total = labelW + messageW;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${height}" role="img" aria-label="${escapeHtml(`${label}: ${message}`)}">
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".12" />
    <stop offset="1" stop-opacity=".12" />
  </linearGradient>
  <clipPath id="c"><rect width="${total}" height="${height}" rx="3" fill="#fff" /></clipPath>
  <g clip-path="url(#c)">
    <rect width="${labelW}" height="${height}" fill="#f47c94" />
    <rect x="${labelW}" width="${messageW}" height="${height}" fill="#101014" />
    <rect width="${total}" height="${height}" fill="url(#g)" />
  </g>
  <g font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="${fontSize}" text-anchor="middle">
    <text x="${labelW / 2}" y="14" fill="#180a0f">${escapeHtml(label)}</text>
    <text x="${labelW + messageW / 2}" y="14" fill="#fff">${escapeHtml(message)}</text>
  </g>
</svg>
`;
}

/** 把 head 里已有的标签换掉（不存在就补一个），避免出现两个 description */
function upsertHead(html, { title, description, canonical, type = 'website', image }) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);

  const tags = [
    ['name', 'description', description],
    ['property', 'og:type', type],
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', canonical],
    ['name', 'twitter:card', 'summary'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ];
  if (image) {
    tags.push(['property', 'og:image', image], ['name', 'twitter:image', image]);
  }

  const markup = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    ...tags.map(([attr, key, content]) =>
      attr === 'property'
        ? `<meta property="${key}" content="${escapeHtml(content)}" />`
        : `<meta name="${key}" content="${escapeHtml(content)}" />`,
    ),
  ].join('\n    ');

  // 旧的 description 先删掉，再由上面的整组标签统一插入
  out = out.replace(/\s*<meta\s+name="description"[\s\S]*?\/>/, '');
  out = out.replace(/\s*<link\s+rel="canonical"[\s\S]*?\/>/, '');
  return out.replace('</head>', `  ${markup}\n  </head>`);
}

function injectJsonLd(html, data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return html.replace(
    '</head>',
    `  <script type="application/ld+json">${json}</script>\n  </head>`,
  );
}

/** 预渲染阶段的占位正文：React 挂载后会替换 #root 的内容 */
function injectCrawlBody(html, bodyHtml) {
  return html.replace(
    /<div id="root">\s*<\/div>/,
    `<div id="root"><div style="max-width:72rem;margin:0 auto;padding:24px 16px">${bodyHtml}</div></div>`,
  );
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

const shell = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
const list = await readJson(path.join(dataDir, 'projects.json'));
if (!list) {
  console.error(`[prerender] 读不到 ${path.join(dataDir, 'projects.json')}，跳过预渲染`);
  process.exit(0);
}

const projects = list.projects ?? [];
const urls = [];

// ── 首页 ────────────────────────────────────────────────────────────────────
{
  let html = upsertHead(shell, {
    title: `${SITE_NAME} · 城大开源自助导航`,
    description: `香港城市大学（CityU）学生开源项目导航：已收录 ${projects.length} 个项目，支持按作者、专业、标签、语言与分类检索，一键直达 GitHub 仓库。`,
    canonical: `${SITE_ORIGIN}/`,
  });
  html = injectJsonLd(html, {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: '城大开源自助导航',
    url: `${SITE_ORIGIN}/`,
    inLanguage: 'zh-CN',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_ORIGIN}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });

  const items = projects
    .slice(0, 30)
    .map(
      (project) =>
        `<li><a href="${BASE_PATH}/project/${encodeURIComponent(project.id)}">${escapeHtml(project.name)}</a> — ${escapeHtml(clamp(project.about || project.description || '', 90))}</li>`,
    )
    .join('\n      ');
  html = injectCrawlBody(
    html,
    `<h1>${escapeHtml(SITE_NAME)} · 城大开源自助导航</h1>
      <p>香港城市大学学生开源项目导航站，已收录 ${projects.length} 个项目。</p>
      <ul>
      ${items}
      </ul>`,
  );

  await fs.writeFile(path.join(distDir, 'index.html'), html, 'utf8');
  urls.push({ loc: `${SITE_ORIGIN}/`, lastmod: (list.generatedAt ?? '').slice(0, 10), priority: '1.0' });
}

// ── 每个项目一页 ─────────────────────────────────────────────────────────────
for (const project of projects) {
  const detail =
    (await readJson(path.join(dataDir, 'projects', `${project.id}.json`))) ?? project;
  const about = (detail.about ?? '').trim();
  const description = clamp(about || detail.description || `${project.name} —— 城大开源项目`, 150);
  const url = `${SITE_ORIGIN}/project/${encodeURIComponent(project.id)}`;

  let html = upsertHead(shell, {
    title: `${project.name} · ${SITE_NAME}`,
    description,
    canonical: url,
    type: 'article',
  });
  html = injectJsonLd(html, {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: detail.name ?? project.name,
    description,
    codeRepository: detail.githubUrl,
    url,
    author: { '@type': 'Person', name: detail.authorName || detail.author },
    programmingLanguage: detail.language || undefined,
    keywords: (detail.tags ?? []).join(', ') || undefined,
    dateModified: detail.updatedAt || undefined,
  });

  const metaLine = [
    detail.authorName && detail.authorName !== detail.author ? `${detail.author}（${detail.authorName}）` : detail.author,
    detail.major,
    detail.enrollmentYear ? `${detail.enrollmentYear} 级` : '',
    detail.category,
  ]
    .filter(Boolean)
    .join(' · ');

  const body = [
    `<article>`,
    `  <h1>${escapeHtml(detail.name ?? project.name)}</h1>`,
    `  <p>${escapeHtml(metaLine)}</p>`,
    `  <p>仓库：<a href="${escapeHtml(detail.githubUrl)}">${escapeHtml(detail.repo)}</a></p>`,
    about ? `  <p>${escapeHtml(about)}</p>` : '',
    detail.description ? `  <p>${escapeHtml(detail.description)}</p>` : '',
    (detail.tags ?? []).length
      ? `  <ul>${(detail.tags ?? []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>`
      : '',
    `  <h2>项目介绍</h2>`,
    `  <p>${escapeHtml(htmlToText(detail.readmeHtml))}</p>`,
    `</article>`,
  ]
    .filter(Boolean)
    .join('\n  ');

  const outDir = path.join(distDir, 'project', project.id);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'index.html'), injectCrawlBody(html, body), 'utf8');

  // 徽章：作者贴到自己仓库 README，既是被收录的标记，也带来一条反向链接与点击回流
  const badgeDir = path.join(distDir, 'badge');
  await fs.mkdir(badgeDir, { recursive: true });
  await fs.writeFile(
    path.join(badgeDir, `${project.id}.svg`),
    badgeSvg({ label: SITE_NAME, message: `listed ★ ${detail.stars ?? 0}` }),
    'utf8',
  );

  urls.push({
    loc: url,
    lastmod: detail.updatedAt ?? '',
    priority: '0.8',
  });
}

// ── sitemap 与 robots ───────────────────────────────────────────────────────
{
  const entries = urls
    .map(
      ({ loc, lastmod, priority }) =>
        `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <priority>${priority}</priority>\n  </url>`,
    )
    .join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  await fs.writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');

  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');
  await fs.writeFile(path.join(distDir, 'robots.txt'), robots, 'utf8');
}

console.log(`[prerender] 已生成 ${projects.length + 1} 个页面、sitemap.xml 与 robots.txt → ${distDir}`);
