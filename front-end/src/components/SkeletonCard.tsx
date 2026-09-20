/** 数据加载时的占位卡片 */
export function SkeletonCard() {
  return (
    <div aria-hidden className="panel-brutal p-5">
      <div className="flex items-center gap-2">
        <div className="animate-flicker size-6 border-2 border-line bg-elevated" />
        <div className="animate-flicker h-3 w-20 bg-elevated" />
      </div>
      <div className="animate-flicker mt-4 h-5 w-2/3 bg-elevated" />
      <div className="mt-3 space-y-2">
        <div className="animate-flicker h-3 w-full bg-elevated" />
        <div className="animate-flicker h-3 w-4/5 bg-elevated" />
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="animate-flicker h-5 w-14 border-2 border-line bg-elevated" />
        <div className="animate-flicker h-5 w-16 border-2 border-line bg-elevated" />
        <div className="animate-flicker h-5 w-12 border-2 border-line bg-elevated" />
      </div>
      <div className="mt-4 flex items-center gap-3 border-t-[3px] border-line pt-3">
        <div className="animate-flicker h-3 w-16 bg-elevated" />
        <div className="animate-flicker h-3 w-10 bg-elevated" />
        <div className="animate-flicker ml-auto h-4 w-4 bg-elevated" />
      </div>
    </div>
  );
}
