#!/usr/bin/env node
/**
 * 刷新 README 里的贡献者头像墙与名单。
 *
 * 数据来自 GitHub contributors API（按提交次数排序），写入 README 中所有
 * `<!-- avatars:start -->` … `<!-- avatars:end -->`（头像墙）与
 * `<!-- contributors:start -->` … `<!-- contributors:end -->`（名单）标记区块。
 * 机器人账号（`xxx[bot]`）会被过滤掉。
 *
 * 用法：
 *   node scripts/update-contributors.mjs            # 用 GITHUB_TOKEN / GH_TOKEN 调用 API
 *   README_PATH=README.md node scripts/update-contributors.mjs
 */
import fs from 'node:fs/promises';

const REPO = process.env.GITHUB_REPOSITORY ?? 'Warpshlczy/CityU-Hub';
const README_PATH = process.env.README_PATH ?? 'README.md';
const PER_PAGE = 100;
const AVATAR_SIZE = 96;
const AVATAR_WIDTH = 48;

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
function avatarUrl(item, size = AVATAR_SIZE) {
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

/** 头像墙：每个贡献者一个带提示的圆形头像链接 */
function renderAvatars(contributors) {
  if (contributors.length === 0) return '';
  return contributors
    .map((item) => {
      const count = item.contributions ?? 0;
      const commits = `${count} commit${count === 1 ? '' : 's'}`;
      return (
        `<a href="${item.html_url}" title="${item.login} · ${commits}">` +
        `<img src="${avatarUrl(item)}" width="${AVATAR_WIDTH}" height="${AVATAR_WIDTH}" alt="${item.login}" /></a>`
      );
    })
    .join('\n');
}

const BLOCKS = [
  { name: '头像墙', start: '<!-- avatars:start -->', end: '<!-- avatars:end -->', render: renderAvatars },
  {
    name: '名单',
    start: '<!-- contributors:start -->',
    end: '<!-- contributors:end -->',
    render: renderList,
  },
];

const readme = await fs.readFile(README_PATH, 'utf8');
const contributors = await fetchContributors();
let next = readme;
let touched = 0;

for (const block of BLOCKS) {
  const pattern = new RegExp(`${block.start}[\\s\\S]*?${block.end}`, 'g');
  const found = next.match(pattern) ?? [];
  if (found.length === 0) continue;
  touched += found.length;
  next = next.replace(pattern, `${block.start}\n${block.render(contributors)}\n${block.end}`);
}

if (touched === 0) {
  throw new Error(
    `${README_PATH} 里没有找到 ${BLOCKS.map((b) => b.name).join(' / ')} 标记区块`,
  );
}
if (next === readme) {
  console.log(`贡献者信息无变化（${contributors.length} 位）`);
} else {
  await fs.writeFile(README_PATH, next, 'utf8');
  console.log(`已更新 ${touched} 处贡献者区块，共 ${contributors.length} 位贡献者`);
}
