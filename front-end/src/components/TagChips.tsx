import type { CountItem } from '../types';

export interface TagChipsProps {
  items: string[];
  /** 选中态（实心红 + 辉光） */
  selected?: string[];
  /** 传入后 chip 变为可点击按钮 */
  onToggle?: (name: string) => void;
  /** 最多展示数量，超出显示 +N */
  max?: number;
  size?: 'sm' | 'md';
  /** 横向滚动场景下不换行 */
  nowrap?: boolean;
  /** 可选的计数展示（侧边栏标签云用） */
  counts?: CountItem[];
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

/** 方形像素标签 chips：2px 硬边框，hover 变霓虹红 + 辉光，选中态实心红 */
export function TagChips({
  items,
  selected = [],
  onToggle,
  max,
  size = 'md',
  nowrap = false,
  counts,
}: TagChipsProps) {
  const visible = typeof max === 'number' ? items.slice(0, max) : items;
  const hiddenCount = items.length - visible.length;
  const countMap = counts ? new Map(counts.map((item) => [item.name, item.count])) : null;

  const chipClass = (isActive: boolean) =>
    ['chip-brutal shrink-0', SIZE_CLASSES[size], isActive ? 'is-active' : ''].join(' ');

  return (
    <div className={`flex items-center gap-1.5 ${nowrap ? 'flex-nowrap' : 'flex-wrap'}`}>
      {visible.map((item) => {
        const isActive = selected.some((value) => value.toLowerCase() === item.toLowerCase());
        const count = countMap?.get(item);

        return onToggle ? (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            aria-pressed={isActive}
            className={chipClass(isActive)}
          >
            {item}
            {count !== undefined && <span className="opacity-70">{count}</span>}
          </button>
        ) : (
          <span key={item} className={chipClass(isActive)}>
            {item}
          </span>
        );
      })}

      {hiddenCount > 0 && (
        <span className={chipClass(false)}>+{hiddenCount}</span>
      )}
    </div>
  );
}
