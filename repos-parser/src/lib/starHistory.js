import fs from 'node:fs/promises';
import path from 'node:path';
import { PARSER_ROOT } from '../config.js';

/**
 * 自建的 star 历史。
 *
 * GitHub 的 stargazers 接口自 2026-07 起只对仓库的 admin / collaborator 开放
 * （github.blog 2026-06-30 的公告），而本站收录的都是别人的仓库，拿不到 starred_at，
 * 所以「近 7 天涨星」只能靠自己每天记一次 star 数，再和 7 天前的记录做差。
 */
const WINDOW_DAYS = 7;
/** 比窗口多留一段，定时任务漏跑几天也还能找到基线 */
const KEEP_DAYS = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_STAR_HISTORY_PATH = path.join(PARSER_ROOT, 'star-history.json');

export function starHistoryPath() {
  return process.env.STAR_HISTORY_PATH || DEFAULT_STAR_HISTORY_PATH;
}

export function shiftDate(date, days) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function isSnapshot(value) {
  return (
    value &&
    typeof value === 'object' &&
    DATE_RE.test(value.date ?? '') &&
    value.stars &&
    typeof value.stars === 'object' &&
    !Array.isArray(value.stars)
  );
}

/** 按日期升序返回快照；读不到或格式不对都当作没有历史，不让构建挂掉 */
export async function readStarHistory(file = starHistoryPath()) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return (Array.isArray(parsed?.snapshots) ? parsed.snapshots : [])
      .filter(isSnapshot)
      .map((snapshot) => ({ date: snapshot.date, stars: { ...snapshot.stars } }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

/**
 * 当前 star 数减去「最近的、且已满 7 天」那次快照的 star 数。
 * 历史还没攒够 7 天时返回 null —— 拿 0 冒充会让面板显示成「+0」，看不出是没数据。
 */
export function computeStarsGained7d(history, repo, currentStars, today) {
  let baseline = null;
  for (const snapshot of history) {
    if (snapshot.date >= today) continue;
    if (daysBetween(snapshot.date, today) >= WINDOW_DAYS) baseline = snapshot;
  }
  const previous = baseline?.stars?.[repo];
  if (!Number.isFinite(previous) || !Number.isFinite(currentStars)) return null;
  return Math.max(0, currentStars - previous);
}

/** 记下今天的 star 数（同一天重跑覆盖），并丢掉过期快照 */
export function recordSnapshot(history, today, starsByRepo) {
  const cutoff = shiftDate(today, -KEEP_DAYS);
  return [
    ...history.filter((snapshot) => snapshot.date !== today && snapshot.date >= cutoff),
    { date: today, stars: { ...starsByRepo } },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function serializeStarHistory(history) {
  return `${JSON.stringify({ version: 1, snapshots: history }, null, 2)}\n`;
}