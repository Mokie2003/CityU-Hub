#!/usr/bin/env node
/**
 * 记一次所有仓库当前 star 数，写进 repos-parser/star-history.json。
 *
 * 构建时算「近 7 天涨星」要用这份历史：GitHub 的 stargazers 接口自 2026-07 起
 * 只对仓库 admin / collaborator 开放，收录的又都是别人的仓库，拿不到 starred_at。
 * 同一天重跑会覆盖当天的记录，所以本地修完文件再跑一次也不会多出一条。
 *
 * 用法：node scripts/update-star-history.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../repos-parser/src/config.js';
import { parseFrontmatterDocument } from '../repos-parser/src/lib/frontmatter.js';
import { createGithubClient, parseRepoUrl } from '../repos-parser/src/lib/github.js';
import {
  readStarHistory,
  recordSnapshot,
  serializeStarHistory,
  starHistoryPath,
} from '../repos-parser/src/lib/starHistory.js';

const REPOS_DIR = path.resolve(process.env.REPOS_DIR ?? 'repos');
const HISTORY_PATH = path.resolve(starHistoryPath());
/** 允许覆盖日期，方便补录或本地验证 */
const today = process.env.SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10);

const entries = await fs.readdir(REPOS_DIR, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_template.md')
  .map((entry) => entry.name)
  .sort();

const github = createGithubClient(loadConfig());
const stars = {};

for (const fileName of files) {
  const source = await fs.readFile(path.join(REPOS_DIR, fileName), 'utf8');
  let ref;
  try {
    ref = parseRepoUrl(parseFrontmatterDocument(source, fileName).meta.repoUrl);
  } catch (error) {
    console.warn(`[star-history] ${fileName}: 读取 front matter 失败，跳过 —— ${error.message}`);
    continue;
  }
  if (!ref) {
    console.warn(`[star-history] ${fileName}: repoUrl 不是可识别的 GitHub 仓库地址，跳过`);
    continue;
  }

  try {
    stars[`${ref.owner}/${ref.repo}`] = (await github.fetchRepoMeta(ref)).stars;
  } catch (error) {
    // 限流或断网时宁可少记一个仓库，也不要用 0 冒充它的 star 数
    console.warn(`[star-history] ${fileName}: 读取 star 数失败，本次不记录 —— ${error.message}`);
  }
}

if (Object.keys(stars).length === 0) {
  console.warn('[star-history] 一个仓库都没取到，跳过写入');
  process.exit(0);
}

const history = await readStarHistory(HISTORY_PATH);
const next = serializeStarHistory(recordSnapshot(history, today, stars));
const previous = await fs.readFile(HISTORY_PATH, 'utf8').catch(() => null);

if (previous === next) {
  console.log(`[star-history] ${today} 的快照无变化，跳过写入`);
  process.exit(0);
}

await fs.writeFile(HISTORY_PATH, next, 'utf8');
console.log(`[star-history] 已记录 ${today} 的 star 数（${Object.keys(stars).length} 个仓库）：${HISTORY_PATH}`);