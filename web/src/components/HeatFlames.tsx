import { HEAT_LABELS } from '../utils/heat';

/**
 * 热度等级的火焰图标：等级越高火苗越多、烧得越旺。
 * 每朵火苗的跳动错开一点相位，避免整排同步闪动像在打拍子。
 */
export function HeatFlames({ level, className = '' }: { level: 1 | 2 | 3; className?: string }) {
  return (
    <span
      className={`heat-flames ${className}`}
      data-level={level}
      title={`热度 ${HEAT_LABELS[level]}`}
      role="img"
      aria-label={`热度 ${HEAT_LABELS[level]}`}
    >
      {Array.from({ length: level }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className="heat-flame"
          style={{ animationDelay: `${index * 0.23}s` }}
        >
          🔥
        </span>
      ))}
    </span>
  );
}
