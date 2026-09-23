import { HEAT_LABELS } from '../utils/heat';

/** 热度火焰图标。每朵火苗的相位要错开，不然整排同步闪动像在打拍子。 */
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
