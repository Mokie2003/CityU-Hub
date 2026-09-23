import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SubmitDialog } from './SubmitDialog';

/** 顶栏按钮：打开提交面板（网页填表 / 去 GitHub 手写）。窄屏只留图标，避免挤占搜索栏 */
export function SubmitProject() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Submit"
        aria-expanded={open}
        title="我也要提交项目"
        className="chip-brutal flex h-11 shrink-0 items-center gap-2 px-3 text-[9px]"
      >
        <Plus className="size-4 text-brand" />
        <span className="pixel hidden sm:inline">Submit</span>
      </button>

      {open && <SubmitDialog onClose={() => setOpen(false)} />}
    </>
  );
}
