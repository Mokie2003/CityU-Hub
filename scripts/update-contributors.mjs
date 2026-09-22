#!/usr/bin/env node
/**
 * 刷新 README 里的贡献者头像墙。
 *
 * 数据来自 GitHub contributors API（按提交次数排序），写入 README 中所有
 * `<!-- contributors:start -->` … `<!-- contributors:end -->` 标记区块。
 * 只渲染头像、不显示提交次数，机器人账号（`xxx[bot]`）会被过滤掉。
 *
 * 关于居中：GitHub 的 markdown 样式是
 *   table { display: block; width: max-content; max-width: 100%; overflow: auto; }
 *   且会剥掉内联 style，所以 `width="100%"` 无效。
 *
 * 表格宽度是 max-content 再被 max-width 卡住，列宽本身又随浏览器窗口变化，
 * 所以「用固定像素的 &emsp; 占位把边框撑满整行」这条路走不通：占位一旦让内容
 * 超过列宽，超出的部分只会被 overflow 裁在右侧，头像就会整体偏右，且窗口越窄偏得越多。
 *
 * 改为完全自适应：给 <table> 加 align="center"（GitHub 会保留该属性，等价于
 * `margin-left/right: auto`），表格按自身内容宽收缩后由 auto margin 居中，
 * 任何列宽下都对齐；头像之间用可断行的间隙，贡献者多到一行放不下时自动换行，
 * 每一行再由单元格的 align="center" 居中。
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
/** 头像之间的间隙：&nbsp; 撑开约 9px，其后的空格提供换行机会，便于自动换行 */
const AVATAR_GAP_HTML = '&nbsp; ';
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

/** 头像墙：只有头像，悬停显示用户名，点击进个人主页 */
function renderAvatars(contributors) {
  if (contributors.length === 0) return '&nbsp;';
  return contributors
    .map(
      (item) =>
        `<a href="${item.html_url}" title="${item.login}">` +
        `<img src="${avatarUrl(item)}" width="${AVATAR_WIDTH}" height="${AVATAR_WIDTH}" alt="${item.login}" /></a>`,
    )
    .join(AVATAR_GAP_HTML);
}

/** 头像墙面板：align="center" 让表格按内容宽自适应居中，下方一行致谢 */
function renderPanel(contributors) {
  return [
    '<table border="1" cellspacing="0" cellpadding="14" align="center">',
    `<tr><td align="center">${renderAvatars(contributors)}</td></tr>`,
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
