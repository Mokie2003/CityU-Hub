import type { ProjectStats } from '../api/stats';
import type { Project } from '../types';
import { computeHeat, HEAT_LABELS } from '../utils/heat';
import { HeatFlames } from './HeatFlames';

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
            <span className="mono w-8 shrink-0 text-right text-[10px] text-muted tabular-nums">
              {Math.round(part.points)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mono mt-4 text-[10px] leading-5 text-muted">
        综合 Star 总数、近 7 天涨星、站内浏览、跳转 GitHub 的点击、Fork 数与最近更新时间。
        站内数据是匿名计数，浏览器开启 Do Not Track 时不参与统计。
      </p>
    </section>
  );
}
