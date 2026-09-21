import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
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

        <Link to="/" className="flex shrink-0 items-center gap-3 focus-visible:outline-none">
          {/* 原始比例 1972×1188，保持宽高比不裁切 */}
          <img
            src={cityuLogo}
            alt="CityU Hub 标志"
            width={120}
            height={72}
            className="glow-pulse h-18 w-auto"
          />
          <span className="flex flex-col gap-1.5 leading-none">
            <span className="pixel text-[16px] font-bold text-ink [text-shadow:2px_2px_0_rgba(244,124,148,0.7)]">
              CITYU&nbsp;HUB
            </span>
            <span className="mono text-[14px] font-bold text-muted">城大开源自助导航</span>
          </span>
        </Link>

        <div className="order-last w-full min-w-0 lg:order-none lg:w-auto lg:flex-1">
          {searchSlot}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <UsefulLinks />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
