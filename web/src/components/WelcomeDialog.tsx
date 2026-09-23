import { useState } from 'react';
import { ArrowRight, BookOpen, HeartHandshake } from 'lucide-react';
import { SubmitDialog } from './SubmitDialog';

/**
 * 首访问欢迎弹窗的「不再提示」标记。勾选后写入 localStorage，之后不再弹出。
 * scripts/update-screenshot.mjs 里有一个同名常量，用来在截图前抑制弹窗，改动时两处同步。
 */
const DISMISS_KEY = 'cityu-hub:welcome-dismissed';

/** logo 与站点图标共用 public/cityu.jpg */
const cityuLogo = `${import.meta.env.BASE_URL}cityu.jpg`;

/** 成为贡献者的好处 */
const BENEFITS: Array<{ emoji: string; title: string; detail: string }> = [
  {
    emoji: '🏷️',
    title: '名字进入贡献者名单',
    detail: '仓库首页的贡献者墙与站内的作者榜都会记上你',
  },
  {
    emoji: '📣',
    title: '项目获得更多曝光',
    detail: '同学按分类、标签、语言就能搜到，一键直达你的仓库',
  },
  {
    emoji: '🎓',
    title: '变成可展示的作品',
    detail: '一个固定链接，方便写进简历、课程作业与个人主页',
  },
  {
    emoji: '🤝',
    title: '帮到后来的同学',
    detail: '把散落各处的资料，攒成大家都能用的公共资源',
  },
];

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    // 隐私模式下 localStorage 会抛错，当作没勾选过
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* 存不进去也不影响这次浏览 */
  }
}

/** 首次访问的欢迎弹窗：介绍站点目标与贡献者收益，并引导去提交项目 */
export function WelcomeDialog() {
  const [visible, setVisible] = useState(() => !readDismissed());
  const [neverShow, setNeverShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!visible) return null;

  /** 关闭时按勾选状态决定是否记住；不勾选则下次访问仍然弹出 */
  const close = () => {
    if (neverShow) writeDismissed();
    setVisible(false);
  };

  if (submitting) return <SubmitDialog onClose={close} />;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={close} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="欢迎来到 CityU Hub"
        className="panel-brutal relative my-4 w-full max-w-xl p-5 sm:p-6"
      >
        <div className="flex items-center gap-4">
          <img
            src={cityuLogo}
            alt="CityU Hub 标志"
            width={120}
            height={72}
            className="glow-pulse h-12 w-auto shrink-0 sm:h-16"
          />
          <div className="min-w-0">
            <h2 className="pixel text-[11px] leading-relaxed text-ink sm:text-[13px]">
              CityU&nbsp;Hub 欢迎你 🎉
            </h2>
            <p className="mono mt-2 text-[11px] text-muted">城大开源自助导航</p>
          </div>
        </div>

        <p className="mono mt-5 border-l-[3px] border-brand bg-surface px-3 py-3 text-[12px] leading-6 text-ink sm:text-[13px]">
          我们想把它做成城大<strong className="text-brand">最完整的开源资源聚合库</strong>
          ，而这件事离不开你的贡献 ✨
          <br />
          如果你的仓库对同学有用，欢迎放进来，让更多人找到它。
        </p>

        <ul className="mt-5 space-y-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex items-start gap-3 border-2 border-line bg-surface px-3 py-2.5">
              <span className="shrink-0 text-[15px] leading-6" aria-hidden>
                {benefit.emoji}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="pixel text-[9px] text-ink">{benefit.title}</span>
                <span className="mono text-[11px] text-muted">{benefit.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setSubmitting(true)}
            className="btn-brutal btn-brutal-primary w-full sm:w-auto"
          >
            <HeartHandshake className="size-4" />
            我也要提交项目
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={close}
            className="btn-brutal btn-brutal-secondary w-full sm:w-auto"
          >
            <BookOpen className="size-4" />
            先随便看看
          </button>
        </div>

        <label className="mono mt-5 flex cursor-pointer items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={neverShow}
            onChange={(event) => setNeverShow(event.target.checked)}
            className="size-4 shrink-0 accent-brand"
          />
          不再提示（记住我的选择）
        </label>
      </div>
    </div>
  );
}
