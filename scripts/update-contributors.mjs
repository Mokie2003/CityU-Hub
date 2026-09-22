#!/usr/bin/env node
/**
 * 刷新 README 里的贡献者头像墙。
 *
 * 数据来自 GitHub contributors API（按提交次数排序），写入 README 中所有
 * `<!-- contributors:start -->` … `<!-- contributors:end -->` 标记区块。
 * 只渲染头像、不显示提交次数，机器人账号（`xxx[bot]`）会被过滤掉。
 *
 * 关于「居中 + 占满整行」：GitHub 的 markdown 样式是
 *   table { display: block; width: max-content; max-width: 100%; overflow: auto; }
 * 且会剥掉内联 style，所以 `width="100%"` 无效。表格先按 max-content 排版，
 * 再被 max-width 卡到正文列宽，而超出部分只会向右溢出 —— 一旦内容超宽，
 * 两侧等量的 `&emsp;` 只会让头像块居中于「超宽的内容行」，而非居中于正文列，
 * 头像就会整体偏右。所以这里按头像块宽度反推占位：
 *   (正文列宽 - 头像块宽) / 2
 * 让「占位 + 头像 + 占位」刚好铺满正文列，头像块便落在正文列的中线上。
 * 行高不写死，随头像数量自动变化。
 *
 * 用法：
 *   node scripts/update-contributors.mjs
 *   README_PATH=README.md GH_TOKEN=xxx node scripts/update-contributors.mjs
 */
import fs from 'node:fs/promises';

const REPO = process.env.GITHUB_REPOSITORY ?? 'Warpshlczy/CityU-Hub';
const README_PATH = process.env.README_PATH ?? 'README.md';
const START = '<!-- contributors:start -->';
const END = '<!-- contributors:end -->';
const PER_PAGE = 100;
/** 展示尺寸与取图尺寸（取图放大，高分屏不糊） */
const AVATAR_WIDTH = 80;
const AVATAR_FILE_SIZE = 200;
/** 头像之间的间距（两个 &nbsp; 约 9px） */
const AVATAR_GAP = 9;
/** GitHub 正文列宽 1012px，扣除单元格左右内边距（13px）与边框（1px）后的可用宽度 */
const CONTENT_WIDTH = 984;
/** &emsp;（em space）在 16px 正文字号下的宽度 */
const EM_SPACE = 16;
/** 面板下方的致谢文案 */
const THANKS_LINE = '✨Thank you all for your contributions to this repository✨';

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';

/** 拉取 contributors，过滤机器人 */
async function fetchContributors() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contributors?per_page=${PER_PAGE}&anon=0`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'cityu-hub-contributors',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);

  const list = await res.json();
  if (!Array.isArray(list)) throw new Error('GitHub API 返回了非预期的数据结构');

  return list.filter(
    (item) => item?.login && item.type !== 'Bot' && !item.login.endsWith('[bot]'),
  );
}

/** 头像地址统一补上尺寸参数 */
function avatarUrl(item, size = AVATAR_FILE_SIZE) {
  const url = item.avatar_url ?? `https://github.com/${item.login}.png`;
  return `${url}${url.includes('?') ? '&' : '?'}s=${size}`;
}

/** 头像墙宽度：N 个头像 + N-1 段间距 */
function rowWidth(count) {
  return count > 0 ? count * AVATAR_WIDTH + (count - 1) * AVATAR_GAP : 0;
}

/**
 * 单侧占位（`&emsp;`）数量：按头像块宽度反推，让整行刚好铺满正文列，
 * 头像块因此居中于正文列。头像多到铺满整列时不再需要占位。
 */
function fillerCount(count) {
  return Math.max(0, Math.round((CONTENT_WIDTH - rowWidth(count)) / 2 / EM_SPACE));
}

/** 头像墙：只有头像，悬停显示用户名，点击进个人主页 */
function renderAvatars(contributors) {
  if (contributors.length === 0) return '&nbsp;';
  return contributors
    .map(
      (item) =>
        `<a href="${item.html_url}" title="${item.login}">` +
        `<img src="${avatarUrl(item)}" width="${AVATAR_WIDTH}" height="${AVATAR_WIDTH}" alt="${item.login}" /></a>`,
    )
    .join('&nbsp;&nbsp;');
}

/** 单行面板：占位 + 头像墙 + 占位（边框占满正文宽度），下方一行致谢 */
function renderPanel(contributors) {
  const filler = '&emsp;'.repeat(fillerCount(contributors.length));
  return [
    '<table border="1" cellspacing="0" cellpadding="14">',
    `<tr><td align="center">${filler}${renderAvatars(contributors)}${filler}</td></tr>`,
    '</table>',
    THANKS_LINE,
  ].join('\n');
}

const readme = await fs.readFile(README_PATH, 'utf8');
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`, 'g');
const blocks = readme.match(pattern) ?? [];
if (blocks.length === 0) {
  throw new Error(`${README_PATH} 里没有找到 ${START} / ${END} 标记区块`);
}

const contributors = await fetchContributors();
const next = readme.replace(pattern, `${START}\n${renderPanel(contributors)}\n${END}`);

if (next === readme) {
  console.log(`贡献者头像墙无变化（${contributors.length} 位）`);
} else {
  await fs.writeFile(README_PATH, next, 'utf8');
  console.log(`已更新 ${blocks.length} 处贡献者头像墙，共 ${contributors.length} 位贡献者`);
}
