import type { ProjectStats } from '../api/stats';

/**
 * 项目热力值：把「外部认可」（stars、近 7 天涨星、forks）、
 * 「站内活跃」（详情页浏览、跳 GitHub 点击数）与「新鲜度」揉成一个百分制分数。
 *
 * 只看等级不看具体分数：具体分数是拍脑袋定的权重算出来的，展示成精确数值容易被
 * 当成客观指标；等级既能表达冷热，也不会被拿去做文章。
 *
 * 各维度先各自归一化到 0–1，再乘权重求和，满分 100。
 */
const WEIGHTS = {
  stars: 35,
  growth: 25,
  views: 15,
  clicks: 15,
  forks: 5,
  freshness: 5,
} as const;

export interface HeatDimensions {
  stars: number;
  /** 近 7 天新增 star */
  growth: number;
  /** 详情页浏览 */
  views: number;
  /** 跳去 GitHub 的点击 */
  clicks: number;
  forks: number;
  freshness: number;
}

export interface HeatResult {
  score: number;
  level: 1 | 2 | 3;
  /** 各维度归一化后的占比（0–1）与加权分，用于详情页拆解 */
  parts: Array<{ key: keyof HeatDimensions; label: string; ratio: number; points: number }>;
}

const LABELS: Record<keyof HeatDimensions, string> = {
  stars: 'Star 总数',
  growth: '近 7 天涨星',
  views: '站内浏览',
  clicks: '跳转 GitHub',
  forks: 'Fork 数',
  freshness: '最近更新',
};

/** 0 个 star → 0 分，100 个 star → 满分；取对数避免大仓库一家独大 */
function starsRatio(stars: number) {
  return Math.min(1, Math.log10(Math.max(0, stars) + 1) / Math.log10(101));
}

function ratio(value: number, full: number) {
  return Math.min(1, Math.max(0, value) / full);
}

export interface HeatInput {
  stars: number;
  starsGained7d?: number;
  forks: number;
  updatedAt?: string;
  stats?: ProjectStats;
}

export function computeHeat(input: HeatInput, now = Date.now()): HeatResult {
  const days = input.updatedAt
    ? Math.max(0, (now - new Date(`${input.updatedAt}T00:00:00Z`).getTime()) / 86_400_000)
    : 999;

  const dimensions: HeatDimensions = {
    stars: starsRatio(input.stars),
    growth: ratio(input.starsGained7d ?? 0, 5),
    views: ratio(input.stats?.views ?? 0, 100),
    clicks: ratio(input.stats?.clicks ?? 0, 25),
    forks: ratio(input.forks, 20),
    // 90 天内线性衰减
    freshness: Math.max(0, 1 - days / 90),
  };

  const parts = (Object.keys(WEIGHTS) as Array<keyof HeatDimensions>).map((key) => ({
    key,
    label: LABELS[key],
    ratio: dimensions[key],
    points: dimensions[key] * WEIGHTS[key],
  }));

  const score = Math.round(parts.reduce((sum, part) => sum + part.points, 0) * 10) / 10;
  const level: HeatResult['level'] = score >= 55 ? 3 : score >= 25 ? 2 : 1;

  return { score, level, parts };
}

/** 等级说明，鼠标悬停与详情页都用它 */
export const HEAT_LABELS: Record<1 | 2 | 3, string> = {
  1: '起步中',
  2: '有点热度',
  3: '当下最热',
};
