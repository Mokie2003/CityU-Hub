#!/usr/bin/env node
/**
 * 抓取站点首页截图，写入 web/public/screenshot.png，并把截图时间与截图者写进 README。
 *
 * README 里的那张「站点一览」图就是本文件产出的 `web/public/screenshot.png`，
 * 所以只要替换这张图片，README 中引用的截图就同步更新了；
 * 图片下方那行时间与截图者由本文件写在
 * `<!-- screenshot:start -->` … `<!-- screenshot:end -->` 标记区块内。
 *
 * 截图参数：桌面视口 1440×900，只截首屏，2 倍像素密度（产物 2880×1800，高分屏不糊）。
 * 站点是纯静态页，动画与字体就绪后再拍，避免拍到淡入过程中的卡片。
 *
 * 图片与标注是一体的：只有截图真的变了才写盘并刷新时间，
 * 截图没变则整个跳过，避免时间戳频繁变动带来无意义的提交。
 *
 * 用法：
 *   node scripts/update-screenshot.mjs
 *   SITE_URL=https://cityu-hub.bond/ SCREENSHOT_BY=alice node scripts/update-screenshot.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const SITE_URL = process.env.SITE_URL ?? 'https://cityu-hub.bond/';
const OUT_PATH = path.resolve(process.env.OUT_PATH ?? 'web/public/screenshot.png');
const README_PATH = process.env.README_PATH ?? 'README.md';
const START = '<!-- screenshot:start -->';
const END = '<!-- screenshot:end -->';
const VIEWPORT = { width: 1440, height: 900 };
/** 2 倍密度：桌面高分屏下文字与边框不糊 */
const DEVICE_SCALE_FACTOR = 2;
/** 卡片有 stagger 淡入（最多 400ms 延迟 + 动画时长），多等一会再拍 */
const SETTLE_MS = 1500;

/** 截图者：CI 里由 workflow 传 github.actor，本地取 git 配置的 user.name */
function resolveCapturedBy() {
  if (process.env.SCREENSHOT_BY?.trim()) return process.env.SCREENSHOT_BY.trim();
  try {
    return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** 北京时间，形如 2026-09-23 10:35 */
function formatCapturedAt(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** 从 PNG 的 IHDR 块读出宽高，用来在日志里对比新旧尺寸 */
function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
}

async function readIfExists(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/** 标记区块内容：截图 + 说明 + 截图时间与截图者（简中 / 繁中 / 英文） */
function renderBlock(capturedAt, capturedBy) {
  const src = path.relative(process.cwd(), OUT_PATH).split(path.sep).join('/');
  return [
    START,
    `<img src="${src}" alt="CityU Hub 首页截图 / homepage screenshot" width="920" />`,
    '',
    '**站点一览 · Homepage at a glance**',
    '',
    `截图时间 / 截圖時間 / captured at: ${capturedAt} (UTC+8) · 截图者 / 截圖者 / by: @${capturedBy}`,
    END,
  ].join('\n');
}

const browser = await chromium.launch();
let shot;
try {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    // 站点按本地时区渲染相对时间，固定成北京时间让产物稳定
    timezoneId: 'Asia/Shanghai',
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  console.log(`打开 ${SITE_URL}`);
  const response = await page.goto(SITE_URL, { waitUntil: 'load' });
  if (response && !response.ok()) {
    throw new Error(`站点返回 HTTP ${response.status()}`);
  }
  // 前端会异步向 GitHub 补语言 / stars，等网络静默；超时不算失败
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);

  shot = await page.screenshot({ type: 'png' });
} finally {
  await browser.close();
}

let previousShot = null;
try {
  previousShot = await fs.readFile(OUT_PATH);
} catch {
  previousShot = null;
}

if (previousShot && previousShot.equals(shot)) {
  console.log(`截图无变化（${pngSize(shot)}），跳过写入与标注刷新`);
  process.exit(0);
}

await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
await fs.writeFile(OUT_PATH, shot);
console.log(`已更新 ${OUT_PATH}：${previousShot ? pngSize(previousShot) : '无'} → ${pngSize(shot)}（${shot.length} 字节）`);

const capturedAt = formatCapturedAt(new Date());
const capturedBy = resolveCapturedBy();
const readme = await readIfExists(README_PATH);
if (readme === null) {
  console.warn(`未找到 ${README_PATH}，跳过截图标注`);
  process.exit(0);
}

const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!pattern.test(readme)) {
  console.warn(`${README_PATH} 里没有找到 ${START} / ${END} 标记区块，跳过截图标注`);
  process.exit(0);
}

const next = readme.replace(pattern, renderBlock(capturedAt, capturedBy));
if (next === readme) {
  console.log('截图标注无变化');
} else {
  await fs.writeFile(README_PATH, next, 'utf8');
  console.log(`已在 ${README_PATH} 标注：${capturedAt} (UTC+8) · @${capturedBy}`);
}
