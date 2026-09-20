/**
 * 零依赖 README 解析：从 Markdown 中提取标题、摘要、目录结构、图片等信息。
 */

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const BADGE_PATTERN =
  /(shields\.io|badgen\.net|badge\.fury\.io|travis-ci|appveyor|circleci|codecov|coveralls|codeclimate|snyk\.io|david-dm|isitmaintained|opencollective|buymeacoffee|ko-fi\.com|hits\.seeyoufarm|visitor-badge|profile-counter|star-history|nodei\.co)/i;

/** 去掉行内 Markdown 标记，得到纯文本 */
export function toPlainText(markdown) {
  return String(markdown ?? '')
    .replace(HTML_COMMENT, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^<>]+>/g, ' ')
    .replace(/^\s{0,3}>\s?/gm, ' ')
    .replace(/[`*_~]+/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugOfHeading(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 抽取 README 标题：优先一级标题，其次 setext 标题，最后取第一行非空文本 */
function extractTitle(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const atx = lines[i].match(/^\s{0,3}#\s+(\S.*?)\s*#*\s*$/);
    if (atx) return { title: atx[1].replace(/[*_`]/g, '').trim(), index: i };
  }
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (lines[i].trim() && /^\s{0,3}={3,}\s*$/.test(lines[i + 1])) {
      return { title: lines[i].replace(/[*_`]/g, '').trim(), index: i };
    }
  }
  const firstTextLine = lines.find((l) => l.trim() && toPlainText(l).length >= 2);
  const fallbackTitle = firstTextLine ? toPlainText(firstTextLine).slice(0, 120) : '';
  return { title: fallbackTitle, index: -1 };
}

function extractHeadings(lines) {
  const headings = [];
  for (const line of lines) {
    const m = line.match(/^\s{0,3}(#{1,6})\s+(\S.*?)\s*#*\s*$/);
    if (!m) continue;
    const text = toPlainText(m[2]);
    if (!text) continue;
    headings.push({ level: m[1].length, text, slug: slugOfHeading(text) });
  }
  return headings;
}

function extractImages(markdown) {
  const images = [];
  const re = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const url = m[2];
    images.push({ alt: (m[1] ?? '').trim(), url, isBadge: BADGE_PATTERN.test(url) });
  }
  return images;
}

/** 判断段落是否只有徽章/图片/链接等噪声内容 */
function isNoisyBlock(block, title = '') {
  const meaningful = block
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((line) => {
      if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(line)) return false; // 纯图片行
      if (/^<[^>]+>\s*$/.test(line)) return false; // 纯 HTML 标签行
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) return false; // 分隔线
      if (/^\s*\[!\[/.test(line)) return false; // 徽章行
      if (/^\|/.test(line)) return false; // 表格行
      if (/^<p[^>]*>[\s\S]*<\/p>$/.test(line) && !/[\p{L}\p{N}]{12,}/u.test(toPlainText(line))) return false;
      return true;
    });

  if (meaningful.length === 0) return true;

  const plain = toPlainText(meaningful.join(' '));
  if (plain.length < 20) return true;
  if (title && plain.replace(/\s+/g, '') === String(title).replace(/\s+/g, '')) return true;
  if (BADGE_PATTERN.test(plain)) return true;
  const lettersOrCjk = plain.replace(/[^\p{L}\p{N}]/gu, '').length;
  return lettersOrCjk < 8;
}

function truncate(text, max = 220) {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const sentenceEnd = Math.max(
    window.lastIndexOf('。'),
    window.lastIndexOf('！'),
    window.lastIndexOf('？'),
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );
  if (sentenceEnd > max * 0.5) return window.slice(0, sentenceEnd + 1).trim();
  const space = window.lastIndexOf(' ');
  return `${(space > max * 0.5 ? window.slice(0, space) : window).trim()}…`;
}

/** 抽取摘要：跳过徽章/图片区与「安装/Usage」等章节标题，取第一段有实际内容的段落 */
function extractSummary(body, title = '') {
  for (const block of body.split(/\n\s*\n/)) {
    if (isNoisyBlock(block, title)) continue;
    const plain = toPlainText(block);
    if (!plain) continue;
    if (/^(table of contents|目录|安装|install|usage|使用|license|许可|contributing|贡献)/i.test(plain)) continue;
    return truncate(plain);
  }
  return '';
}

/** 中英混排的字符/词/阅读时长估算 */
function textStats(plain) {
  const cjk = (plain.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? []).length;
  const words = (plain.replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, ' ').match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? [])
    .length;
  return {
    charCount: plain.replace(/\s+/g, '').length,
    wordCount: words,
    cjkCount: cjk,
    readingMinutes: Math.max(1, Math.round(cjk / 350 + words / 220)),
  };
}

/**
 * 解析 README 全文
 * @param {string} markdown README 原文
 */
export function analyzeReadme(markdown) {
  const text = String(markdown ?? '').replace(/\r\n?/g, '\n').replace(HTML_COMMENT, '');
  const lines = text.split('\n');
  const { title, index } = extractTitle(lines);
  const bodyLines = index >= 0 ? [...lines.slice(0, index), ...lines.slice(index + 1)] : lines;
  const body = bodyLines.join('\n');

  const headings = extractHeadings(lines);
  const images = extractImages(text);

  return {
    title: title || '',
    summary: extractSummary(body, title),
    headings,
    images,
    firstImage: images.find((img) => !img.isBadge) ?? null,
    hasBadges: images.some((img) => img.isBadge),
    hasCodeBlock: /```[\s\S]*?```/.test(text),
    stats: textStats(toPlainText(body)),
  };
}

/** 在项目介绍或 Features 为空时，按需补齐内容。 */
export function fillProjectContent(markdown, { readme = '', description = '' } = {}) {
  const text = String(markdown ?? '').replace(/\r\n?/g, '\n');
  const featuresHeading = /^\s{0,3}##\s+Features\s*#*\s*$/im;
  const match = featuresHeading.exec(text);
  const intro = match ? text.slice(0, match.index).trim() : text.trim();
  const featureBody = match
    ? text.slice(match.index + match[0].length).match(/^[\s\S]*?(?=^\s{0,3}#{1,6}\s+|$)/m)?.[0].trim() ?? ''
    : '';

  let result = text.trim();
  const replacedIntro = !intro && String(readme).trim();
  if (replacedIntro) result = String(readme).trim();
  if (match && !featureBody && String(description).trim()) {
    if (replacedIntro) result = `${result}\n\n${match[0].trim()}`;
    result = `${result}\n\n${String(description).trim()}`;
  }
  return result.trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(markdown) {
  let html = escapeHtml(markdown);
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  return html;
}

export function renderMarkdownHtml(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];
  let code = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
      list = [];
    }
  };

  for (const line of lines) {
    if (code) {
      if (line.trim().startsWith('```')) {
        blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushList();
      code = [];
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (item) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (code) blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return blocks.join('\n');
}

/** 仓库没提供 topics 时，用 README 关键词兜底推断标签 */
export function guessTagsFromReadme(markdown, { language, topics = [] } = {}) {
  const lower = String(markdown ?? '').toLowerCase();
  const dictionary = [
    'react', 'vue', 'angular', 'svelte', 'next.js', 'vite', 'tailwindcss', 'typescript', 'javascript',
    'node.js', 'express', 'python', 'django', 'flask', 'fastapi', 'java', 'spring boot', 'go', 'rust',
    'docker', 'kubernetes', 'mysql', 'postgresql', 'mongodb', 'redis', 'machine learning', 'deep learning',
    'pytorch', 'tensorflow', 'llm',
  ];

  const found = new Set();
  for (const t of topics) found.add(String(t).toLowerCase());
  if (language) found.add(String(language).toLowerCase());
  for (const key of dictionary) {
    if (lower.includes(key)) found.add(key);
  }
  return [...found].slice(0, 12);
}
