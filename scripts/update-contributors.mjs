#!/usr/bin/env node
/**
 * 刷新 README 里的贡献者名单。
 *
 * 数据来自 GitHub contributors API（按提交次数排序），写入 README 中所有
 * `<!-- contributors:start -->` … `<!-- contributors:end -->` 标记区块。
 * 机器人账号（`xxx[bot]`）会被过滤掉。
 *
 * 用法：
 *   node scripts/update-contributors.mjs            # 用 GITHUB_TOKEN / GH_TOKEN 调用 API
 *   README_PATH=README.md node scripts/update-contributors.mjs
 */
import fs from 'node:fs/promises';

const REPO = process.env.GITHUB_REPOSITORY ?? 'Warpshlczy/CityU-Hub';
const README_PATH = process.env.README_PATH ?? 'README.md';
const START = '<!-- contributors:start -->';
const END = '<!-- contributors:end -->';
const PER_PAGE = 100;

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

/** 一行内联名单：[@login](主页) (提交数) · … */
function renderList(contributors) {
  if (contributors.length === 0) return '暂无贡献者，期待你的第一个 PR。';
  return contributors
    .map((item) => `[@${item.login}](${item.html_url}) (${item.contributions})`)
    .join(' · ');
}

const readme = await fs.readFile(README_PATH, 'utf8');
const blockPattern = new RegExp(`${START}[\\s\\S]*?${END}`, 'g');
const blocks = readme.match(blockPattern) ?? [];
if (blocks.length === 0) {
  throw new Error(`${README_PATH} 里没有找到 ${START} / ${END} 标记区块`);
}

const contributors = await fetchContributors();
const next = readme.replace(blockPattern, `${START}\n${renderList(contributors)}\n${END}`);

if (next === readme) {
  console.log(`贡献者名单无变化（${contributors.length} 位）`);
} else {
  await fs.writeFile(README_PATH, next, 'utf8');
  console.log(`已更新 ${blocks.length} 处贡献者名单，共 ${contributors.length} 位贡献者`);
}
