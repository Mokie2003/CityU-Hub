#!/usr/bin/env node
/**
 * 刷新 README 里的贡献者面板（头像墙 + 名单合成的一张全宽表格）。
 *
 * 数据来自 GitHub contributors API（按提交次数排序），写入 README 中所有
 * `<!-- contributors:start -->` … `<!-- contributors:end -->` 标记区块。
 * 机器人账号（`xxx[bot]`）会被过滤掉。
 *
 * 关于「全宽边框」：GitHub 的 markdown 样式是
 *   table { display: block; width: max-content; max-width: 100%; }
 * 且会剥掉内联 style，所以 `width="100%"` 无效；这里改为在标题行左右各铺一段
 * 不可见的 `&emsp;` 占位，让 max-content 超过容器宽度、被 max-width:100% 截住，
 * 表格即占满整行；行高不写死，随头像数量与文案自动变化。
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
const AVATAR_WIDTH = 96;
const AVATAR_FILE_SIZE = 240;
/** 标题行左右各 80 个 &emsp;，合计约 2500px，必定超过容器宽度 */
const WIDTH_FILLER = '&emsp;'.repeat(80);
const PANEL_TITLE = '▛▀▀▀  CONTRIBUTORS · 贡献者 · 貢獻者  ▀▀▀▜';

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

/** 一行内联名单：[@login](主页) (提交数) · … */
function renderList(contributors) {
  if (contributors.length === 0) return '暂无贡献者，期待你的第一个 PR。';
  return contributors
    .map((item) => `[@${item.login}](${item.html_url}) (${item.contributions})`)
    .join(' · ');
}

/** 头像墙：悬停显示「用户名 · 提交数」，点击进个人主页 */
function renderAvatars(contributors) {
  if (contributors.length === 0) return '&nbsp;';
  return contributors
    .map((item) => {
      const count = item.contributions ?? 0;
      const commits = `${count} commit${count === 1 ? '' : 's'}`;
      return (
        `<a href="${item.html_url}" title="${item.login} · ${commits}">` +
        `<img src="${avatarUrl(item)}" width="${AVATAR_WIDTH}" height="${AVATAR_WIDTH}" alt="${item.login}" /></a>&nbsp;&nbsp;`
      );
    })
    .join('\n');
}

/** 一张全宽面板：标题行 / 头像墙 / 名单行（第 2 行会被 GitHub 的斑马纹加上底色） */
function renderPanel(contributors) {
  return [
    '<table border="1" cellspacing="0" cellpadding="14">',
    `<tr><th align="center">${WIDTH_FILLER}${PANEL_TITLE}${WIDTH_FILLER}</th></tr>`,
    `<tr><td align="center">${renderAvatars(contributors)}</td></tr>`,
    `<tr><td align="center">${renderList(contributors)}</td></tr>`,
    '</table>',
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
  console.log(`贡献者面板无变化（${contributors.length} 位）`);
} else {
  await fs.writeFile(README_PATH, next, 'utf8');
  console.log(`已更新 ${blocks.length} 处贡献者面板，共 ${contributors.length} 位贡献者`);
}
