import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = '未找到匹配项目',
  description = '试试减少筛选条件，或更换关键词。',
  actionLabel = '清除全部筛选',
  onAction,
}: EmptyStateProps) {
  return (
    <div className="animate-fade-in-up panel-brutal flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="animate-border-flicker grid size-16 place-items-center border-[3px] text-brand">
        <SearchX className="size-7" />
      </span>
      <h3 className="text-base font-black text-ink">{title}</h3>
      <p className="mono max-w-sm text-[13px] text-muted">{description}</p>
      {onAction && (
        <button type="button" onClick={onAction} className="btn-brutal btn-brutal-primary">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
