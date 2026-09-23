import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { SubmitProject } from './SubmitProject';
import { ThemeToggle } from './ThemeToggle';
import { UsefulLinks } from './UsefulLinks';

/** 页内 logo 与站点图标共用 public/cityu.jpg 这一份文件 */
const cityuLogo = `${import.meta.env.BASE_URL}cityu.jpg`;

interface HeaderProps {
  /** 首页把搜索栏塞进来，详情页不传 */
  searchSlot?: ReactNode;
  onOpenSidebar?: () => void;
}

/** 固定顶栏：3px 硬白边框 + 像素 logo（public/cityu.jpg） */
export function Header({ searchSlot, onOpenSidebar }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-line bg-canvas">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-2.5 sm:gap-x-4 sm:gap-y-3 sm:px-6 sm:py-3">
        {onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="打开筛选面板"
            className="btn-brutal btn-brutal-secondary !p-0 size-11 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        )}

        <Link to="/" className="flex shrink-0 items-center gap-2 focus-visible:outline-none sm:gap-3">
          {/* 原始比例 1972×1188，保持宽高比不裁切 */}
          <img
            src={cityuLogo}
            alt="CityU Hub 标志"
            width={120}
            height={72}
            className="glow-pulse h-11 w-auto sm:h-18"
          />
          <span className="flex flex-col gap-1 leading-none sm:gap-1.5">
            <span className="pixel text-[13px] font-bold text-ink [text-shadow:2px_2px_0_rgba(244,124,148,0.7)] sm:text-[16px]">
              CITYU&nbsp;HUB
            </span>
            <span className="mono text-[11px] font-bold text-muted sm:text-[14px]">
              城大开源自助导航
            </span>
          </span>
        </Link>

        {/* 有搜索栏时移动端整行独占第二行，桌面端与搜索栏并排；
            详情页没有搜索栏，按钮照旧靠右与 logo 同行 */}
        <div
          className={[
            'flex min-w-0 items-center gap-2',
            searchSlot
              ? 'order-last w-full lg:order-none lg:w-auto lg:flex-1'
              : 'ml-auto',
          ].join(' ')}
        >
          {searchSlot && <div className="min-w-0 flex-1">{searchSlot}</div>}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SubmitProject />
            <UsefulLinks />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
