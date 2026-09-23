import { Plus } from 'lucide-react';

/**
 * 「我也要提交项目」入口。
 *
 * 指向 GitHub 的文件编辑器，目标分支固定为 feature、文件名预填 repos/my-project.md，
 * 没有写权限时会自动 fork，提交后直接开出 PR —— 与 README「一键唤起」表里的一致。
 * 仓库地址变更时这里要跟着改。
 */
const SUBMIT_URL =
  'https://github.com/Warpshlczy/CityU-Hub/new/feature?filename=repos/my-project.md';

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
      <span className="pixel hidden sm:inline">我也要提交项目</span>
    </a>
  );
}
