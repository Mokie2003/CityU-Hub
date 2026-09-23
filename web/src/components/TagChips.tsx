import type { CountItem } from '../types';

export interface TagChipsProps {
  items: string[];
  selected?: string[];
  /** 传了才渲染成可点击的按钮 */
  onToggle?: (name: string) => void;
  max?: number;
  size?: 'sm' | 'md';
  nowrap?: boolean;
  counts?: CountItem[];
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

/** 方形像素标签 chips */
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
