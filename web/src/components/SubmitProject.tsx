import { Plus } from 'lucide-react';
import { SUBMIT_URL } from '../constants/repo';

/** 顶栏按钮：新标签页打开提交流程。窄屏只留图标，避免挤占搜索栏 */
export function SubmitProject() {
  return (
    <a
      href={SUBMIT_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="我也要提交项目"
      title="我也要提交项目"
      className="chip-brutal flex h-11 shrink-0 items-center gap-2 px-3 text-[9px]"
    >
      <Plus className="size-4 text-brand" />
      <span className="pixel hidden sm:inline">SUBMIT</span>
    </a>
  );
}
