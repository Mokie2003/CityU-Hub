import type { ProjectStats } from '../api/stats';
import type { Project } from '../types';
import { computeHeat, HEAT_LABELS } from '../utils/heat';
import type { HeatDimensions } from '../utils/heat';
import { formatNumber } from '../utils/formatNumber';
import { HeatFlames } from './HeatFlames';

/** 显示真实数量，热度高低交给进度条；null 表示这一维还没数据 */
const RAW_FORMAT: Record<keyof HeatDimensions, (value: number | null) => string> = {
  stars: (value) => (value === null ? '—' : formatNumber(value)),
  growth: (value) => (value === null ? '—' : `+${formatNumber(value)}`),
  views: (value) => (value === null ? '—' : formatNumber(value)),
  clicks: (value) => (value === null ? '—' : formatNumber(value)),
  forks: (value) => (value === null ? '—' : formatNumber(value)),
  freshness: (value) => (value === null || value >= 999 ? '—' : `${Math.round(value)}天`),
};

/** 详情页热度拆解：把各维度摊开，说明等级怎么来的。 */
export function HeatPanel({ project, stats }: { project: Project; stats?: ProjectStats }) {
  const heat = computeHeat({ ...project, stats });

  return (
    <section className="panel-brutal mt-6 p-6">
      <h2 className="pixel flex items-center gap-3 text-[10px] text-muted">
        <span className="size-3 shrink-0 bg-brand" />
        项目热度
      </h2>

      <div className="mt-3 flex items-baseline gap-3">
        <HeatFlames level={heat.level} className="text-lg" />
        <span className="pixel text-[10px] text-ink">{HEAT_LABELS[heat.level]}</span>
        <span className="mono ml-auto flex items-baseline gap-1 text-muted">
          <span className="pixel text-[15px] text-brand tabular-nums">{heat.score}</span>
          <span className="text-[10px]">/ 100</span>
        </span>
      </div>

      <ul className="mt-5 space-y-2.5">
        {heat.parts.map((part) => (
          <li key={part.key} className="flex items-center gap-3">
            <span className="mono w-24 shrink-0 text-[11px] text-muted">{part.label}</span>
            <span className="h-2.5 min-w-0 flex-1 border-2 border-line bg-elevated">
              <span
                className="block h-full bg-brand transition-[width] duration-500"
                style={{ width: `${Math.round(part.ratio * 100)}%` }}
              />
            </span>
            <span className="mono w-12 shrink-0 text-right text-[10px] text-muted tabular-nums">
              {RAW_FORMAT[part.key](part.raw)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mono mt-4 text-[10px] leading-5 text-muted">
        热度满分 100，由 Star 总数、近 7 天涨星、站内浏览、跳转 GitHub 的点击、Fork 数
        与最近更新时间加权算出。右侧是各维度的真实数量，进度条是它对热度的贡献；
        显示「—」表示这一维暂时还没有数据。涨星靠站内每天记录一次，
        攒够 7 天后才有值。站内数据是匿名计数，浏览器开启 Do Not Track 时不参与统计。
      </p>
    </section>
  );
}
