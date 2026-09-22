#!/usr/bin/env node
/**
 * 抓取站点首页截图，写入 web/public/screenshot.png，供 README 引用。
 *
 * README 里的那张「站点一览」图就是本文件产出的 `web/public/screenshot.png`，
 * 所以只要替换这张图片，README 中引用的截图就同步更新了。
 *
 * 截图参数：桌面视口 1440×900，只截首屏，2 倍像素密度（产物 2880×1800，高分屏不糊）。
 * 站点是纯静态页，动画与字体就绪后再拍，避免拍到淡入过程中的卡片。
 *
 * 用法：
 *   node scripts/update-screenshot.mjs
 *   SITE_URL=https://cityu-hub.bond/ OUT_PATH=web/public/screenshot.png node scripts/update-screenshot.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const SITE_URL = process.env.SITE_URL ?? 'https://cityu-hub.bond/';
const OUT_PATH = path.resolve(process.env.OUT_PATH ?? 'web/public/screenshot.png');
const VIEWPORT = { width: 1440, height: 900 };
/** 2 倍密度：桌面高分屏下文字与边框不糊 */
const DEVICE_SCALE_FACTOR = 2;
/** 卡片有 stagger 淡入（最多 400ms 延迟 + 动画时长），多等一会再拍 */
const SETTLE_MS = 1500;

/** 从 PNG 的 IHDR 块读出宽高，用来在日志里对比新旧尺寸 */
function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
}

async function readIfExists(file) {
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
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

const previous = await readIfExists(OUT_PATH);
if (previous && previous.equals(shot)) {
  console.log(`截图无变化（${pngSize(shot)}），跳过写入`);
} else {
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, shot);
  const before = previous ? pngSize(previous) : '无';
  console.log(`已更新 ${OUT_PATH}：${before} → ${pngSize(shot)}（${shot.length} 字节）`);
}
