import { useEffect, useState } from 'react';
import { ExternalLink, Link2, X } from 'lucide-react';

interface UsefulLink {
  name: string;
  url: string;
  description: string;
}

const USEFUL_LINKS: UsefulLink[] = [
  {
    name: 'CityU AIMS',
    url: 'https://banweb.cityu.edu.hk/',
    description: '选课、成绩与学籍系统',
  },
  {
    name: 'CityU Canvas',
    url: 'https://canvas.cityu.edu.hk/',
    description: '课程资料、作业与测验',
  },
  {
    name: 'CityU 官网',
    url: 'https://www.cityu.edu.hk/',
    description: '香港城市大学官方网站',
  },
  {
    name: 'CityUHK Portal',
    url: 'https://www.cityu.edu.hk/portal/dashboard',
    description: '校内服务与设施入口',
  },
];

/** 顶栏按钮 + 右侧抽屉：城大常用站点导航 */
export function UsefulLinks() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          aria-label="CityUHK Useful Links"
          aria-expanded={open}
          className="chip-brutal flex h-11 items-center gap-2 px-3 text-[9px]"
        >
          <Link2 className="size-4 text-brand" />
          <span className="pixel hidden sm:inline">LINKS</span>
        </button>

        <span
          role="tooltip"
          className={`pixel pointer-events-none absolute top-full right-0 z-50 mt-2 border-[3px] border-line bg-surface px-3 py-2 text-[9px] whitespace-nowrap text-ink shadow-[4px_4px_0_var(--c-shadow),0_0_18px_var(--glow-brand)] transition-opacity duration-100 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          CityUHK Useful Links
        </span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 right-0 w-80 max-w-[86%] overflow-y-auto border-l-[3px] border-line bg-canvas p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="pixel flex items-center gap-2 text-[10px] text-ink">
                  <span className="size-3 shrink-0 bg-brand" />
                  USEFUL LINKS
                </h2>
                <p className="mono mt-2 text-[11px] text-muted">CityUHK Useful Links</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭链接面板"
                className="btn-brutal btn-brutal-secondary !p-0 size-9"
              >
                <X className="size-4" />
              </button>
            </div>

            <ul className="mt-5 space-y-2">
              {USEFUL_LINKS.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex w-full items-center justify-between gap-3 border-2 border-line bg-surface px-3 py-2.5 transition-colors hover:border-brand hover:text-brand hover:shadow-[0_0_16px_var(--glow-brand)]"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="pixel text-[10px] text-ink">{link.name}</span>
                      <span className="mono truncate text-[11px] text-muted">
                        {link.description}
                      </span>
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
