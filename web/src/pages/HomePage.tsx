import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlert, X } from 'lucide-react';
import { fetchStats, type SiteStats } from '../api/stats';
import { Header } from '../components/Header';
import { ContributorWall } from '../components/ContributorWall';
import { EmptyState } from '../components/EmptyState';
import { GitHubIcon } from '../components/GitHubIcon';
import { ProjectGrid } from '../components/ProjectGrid';
import { SearchBar } from '../components/SearchBar';
import { Sidebar } from '../components/Sidebar';
import { TagChips } from '../components/TagChips';
import { REPO_URL } from '../constants/repo';
import { useProjects } from '../hooks/useProjects';
import { useSearch } from '../hooks/useSearch';
import { useUrlState } from '../hooks/useUrlState';
import type { AuthorItem, SortKey } from '../types';
import { avatarUrl } from '../utils/avatar';
import { formatDateTime } from '../utils/formatNumber';
import { parseQuery } from '../utils/searchParser';
import { setRouteMeta } from '../utils/seo';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'updated', label: '最近更新' },
  { value: 'stars', label: 'Star 最多' },
  { value: 'name', label: '名称排序' },
];

function toSortKey(value: string): SortKey {
  return SORT_OPTIONS.some((option) => option.value === value) ? (value as SortKey) : 'updated';
}

export function HomePage() {
  const { data, loading, error, reload } = useProjects();

  const [query, setQuery, patchParams] = useUrlState('q');
  const [tagsParam, setTagsParam] = useUrlState('tags');
  const [category, setCategory] = useUrlState('category');
  const [sortParam, setSortParam] = useUrlState('sort');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sort = toSortKey(sortParam);

  const selectedTags = useMemo(
    () => (tagsParam ? tagsParam.split(',').filter(Boolean) : []),
    [tagsParam],
  );

  const toggleTag = useCallback(
    (name: string) => {
      const exists = selectedTags.some((value) => value.toLowerCase() === name.toLowerCase());
      const next = exists
        ? selectedTags.filter((value) => value.toLowerCase() !== name.toLowerCase())
        : [...selectedTags, name];
      setTagsParam(next.join(','));
    },
    [selectedTags, setTagsParam],
  );

  const selectCategory = useCallback(
    (name: string) => {
      setCategory(name);
      setDrawerOpen(false);
    },
    [setCategory],
  );

  const selectAuthor = useCallback(
    (name: string) => {
      setQuery(`author:${name}`);
      setDrawerOpen(false);
    },
    [setQuery],
  );

  // 三个参数必须一次性写入，否则同一次 tick 内会被逐个覆盖
  const resetAll = useCallback(() => {
    patchParams({ q: '', tags: '', category: '' });
  }, [patchParams]);

  // 分类 / 标签筛选（useMemo 缓存，搜索在 useSearch 内基于结果再做过滤）
  const scoped = useMemo(() => {
    const projects = data?.projects ?? [];
    return projects.filter((project) => {
      if (category && project.category !== category) return false;
      if (
        selectedTags.length > 0 &&
        !selectedTags.every((tag) =>
          project.tags.some((item) => item.toLowerCase() === tag.toLowerCase()),
        )
      ) {
        return false;
      }
      return true;
    });
  }, [data, category, selectedTags]);

  const results = useSearch(scoped, query, sort);

  // 作者榜：聚合数据只有用户名与计数，头像 / 实名从项目里补
  const authorList = useMemo<AuthorItem[]>(() => {
    const projects = data?.projects ?? [];
    return (data?.authors ?? []).map((item) => {
      const sample = projects.find((project) => project.author === item.name);
      return {
        ...item,
        avatar: avatarUrl(sample?.authorAvatar, sample?.repo),
        realName: sample?.authorName ?? '',
      };
    });
  }, [data]);

  const activeAuthor = parseQuery(query).qualifiers.author[0];
  const hasFilter = Boolean(query || tagsParam || category);

  // 站内统计只用于热力值，拿不到（本地开发 / 未配 Redis）就退化为只用构建期数据
  const [stats, setStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    const ids = (data?.projects ?? []).map((project) => project.id);
    if (ids.length === 0) return;
    let alive = true;
    void fetchStats(ids).then((result) => {
      if (alive) setStats(result);
    });
    return () => {
      alive = false;
    };
  }, [data]);

  /** 近 7 天被收录的项目 */
  const newest = useMemo(() => {
    const since = Date.now() - 7 * 86_400_000;
    return (data?.projects ?? [])
      .filter((project) => project.addedAt && Date.parse(`${project.addedAt}T00:00:00Z`) >= since)
      .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''))
      .slice(0, 6);
  }, [data]);

  useEffect(() => {
    const total = data?.total ?? 0;
    setRouteMeta({
      title: 'CityU Hub · 城大开源自助导航',
      description: `香港城市大学（CityU）学生开源项目导航：已收录 ${total} 个项目，支持按作者、专业、标签、语言与分类检索，一键直达 GitHub 仓库。`,
      path: '/',
    });
  }, [data?.total]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const sidebar = (
    <Sidebar
      categories={data?.categories ?? []}
      tags={data?.tags ?? []}
      authors={authorList}
      total={data?.total ?? 0}
      activeCategory={category}
      selectedTags={selectedTags}
      activeAuthor={activeAuthor}
      onSelectCategory={selectCategory}
      onToggleTag={toggleTag}
      onSelectAuthor={selectAuthor}
    />
  );

  const marqueeText = [
    'CITYU HUB // 城大开源自助导航',
    `${data?.total ?? 0} PROJECTS`,
    `${data?.authors.length ?? 0} CONTRIBUTORS`,
    `${data?.categories.length ?? 0} CATEGORIES`,
    'CityU Hub 正式上线，欢迎提交项目',
    'CityU Hub is officially launched. Welcome to submit your projects.',
  ].join('   ✦   ');

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Header
        searchSlot={<SearchBar value={query} onChange={setQuery} />}
        onOpenSidebar={() => setDrawerOpen(true)}
      />

      {/* 像素滚动公告带 */}
      <div className="marquee-band">
        <div className="marquee-track pixel text-[9px]">
          <span className="pr-12">{marqueeText}</span>
          <span className="pr-12">{marqueeText}</span>
        </div>
      </div>

      {/* 分类 tab + 标签 chips */}
      <div className="border-b-[3px] border-line bg-canvas">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 sm:px-6">
          <div className="edge-fade no-scrollbar flex gap-2 overflow-x-auto">
            <CategoryTab
              label="ALL"
              count={data?.total ?? 0}
              active={category === ''}
              onClick={() => selectCategory('')}
            />
            {(data?.categories ?? []).map((item) => (
              <CategoryTab
                key={item.name}
                label={item.name}
                count={item.count}
                active={category === item.name}
                onClick={() => selectCategory(item.name)}
              />
            ))}
          </div>

          <div className="edge-fade no-scrollbar overflow-x-auto">
            <TagChips
              items={(data?.tags ?? []).map((tag) => tag.name)}
              selected={selectedTags}
              onToggle={toggleTag}
              counts={data?.tags ?? []}
              size="sm"
              nowrap
            />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {/* 共享边框数据条 */}
        <div className="grid grid-cols-2 gap-[3px] border-[3px] border-line bg-line sm:grid-cols-4">
          <StatCell label="PROJECTS" value={data?.total ?? 0} />
          <StatCell label="CATEGORIES" value={data?.categories.length ?? 0} />
          <StatCell label="TAGS" value={data?.tags.length ?? 0} />
          <StatCell label="AUTHORS" value={data?.authors.length ?? 0} />
        </div>

        {newest.length > 0 && (
          <section className="panel-brutal mt-6 p-4">
            <h2 className="pixel flex items-center gap-2 text-[9px] text-muted">
              <span className="size-3 shrink-0 bg-accent" />
              本周新增 · {newest.length}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {newest.map((project) => (
                <li key={project.id}>
                  <Link
                    to={`/project/${project.id}`}
                    className="chip-brutal flex items-center gap-2 px-2.5 py-1.5"
                  >
                    <span className="mono text-[11px] text-ink">{project.name}</span>
                    <span className="mono text-[10px] text-muted">@{project.author}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 flex gap-8">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-28">{sidebar}</div>
          </aside>

          <section className="min-w-0 flex-1">
            <div className="mb-5 flex flex-wrap items-center gap-3 border-[3px] border-line bg-surface px-3 py-2">
              <span className="pixel text-[9px] text-brand">RESULT</span>
              <span className="mono text-[13px] text-muted">
                共 <span className="font-bold text-ink">{results.length}</span> 个项目
              </span>

              {hasFilter && (
                <button
                  type="button"
                  onClick={resetAll}
                  className="chip-brutal px-2 py-0.5 text-[11px]"
                >
                  清除筛选
                </button>
              )}

              <label className="ml-auto flex items-center gap-2">
                <span className="pixel text-[9px] text-muted">SORT</span>
                <select
                  value={sort}
                  onChange={(event) => setSortParam(event.target.value)}
                  className="input-brutal px-2 py-1.5 text-[11px]"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <div className="panel-brutal flex flex-col items-center gap-4 px-6 py-16 text-center">
                <span className="animate-border-flicker grid size-16 place-items-center border-[3px] text-brand">
                  <TriangleAlert className="size-7" />
                </span>
                <p className="mono text-[13px] text-ink">{error}</p>
                <button type="button" onClick={reload} className="btn-brutal btn-brutal-primary">
                  重新加载
                </button>
              </div>
            ) : !loading && (data?.total ?? 0) === 0 ? (
              // 解析成功但一条数据都没有：repos/ 下还没有可用的提交
              <EmptyState
                title="还没有项目数据"
                description="repos/ 目录下没有可展示的项目文档。请按 repos/_template.md 的格式新增一份 Markdown，再重新构建。"
                actionLabel="重新加载"
                onAction={reload}
              />
            ) : (
              <ProjectGrid
                projects={results}
                loading={loading}
                onReset={resetAll}
                stats={stats}
              />
            )}
          </section>
        </div>
      </main>

      <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
        <ContributorWall authors={authorList} />
      </section>

      <footer className="border-t-[3px] border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 sm:px-6">
          <span className="pixel text-[9px] text-brand">CITYU&nbsp;HUB</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="本站 GitHub 仓库（欢迎 Star）"
            title="本站 GitHub 仓库，欢迎 Star 支持"
            className="chip-brutal flex items-center gap-2 px-2.5 py-1"
          >
            <GitHubIcon className="size-3.5" />
            <span className="mono text-[11px]">Warpshlczy/CityU-Hub</span>
            <span className="pixel text-[8px] text-brand">★ STAR</span>
          </a>
          <span className="mono text-[11px] text-muted">{data?.total ?? 0} PROJECTS</span>
          <span className="mono text-[11px] text-muted">
            {data?.authors.length ?? 0} CONTRIBUTORS
          </span>
          <span className="mono text-[11px] text-muted">
            GENERATED {data ? formatDateTime(data.generatedAt) : '—'}
          </span>
          <span className="mono ml-auto text-[11px] text-muted">香港城市大学开源项目导航</span>
        </div>
      </footer>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[82%] overflow-y-auto border-r-[3px] border-line bg-canvas p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="pixel text-[9px] text-ink">FILTER</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭筛选面板"
                className="btn-brutal btn-brutal-secondary !p-0 size-9"
              >
                <X className="size-4" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCellProps {
  label: string;
  value: number;
}

function StatCell({ label, value }: StatCellProps) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="pixel text-[8px] text-muted">{label}</div>
      <div className="pixel mt-2 text-lg text-brand">
        {String(value).padStart(2, '0')}
      </div>
    </div>
  );
}

interface CategoryTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function CategoryTab({ label, count, active, onClick }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'mono flex shrink-0 items-center gap-2 border-[3px] px-3 py-1.5 text-xs transition-all duration-100 [transition-timing-function:step-end]',
        active
          ? 'border-brand bg-brand font-bold text-[#180a0f] shadow-[0_0_18px_var(--glow-brand)]'
          : 'border-line bg-surface text-muted hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-brand hover:text-brand',
      ].join(' ')}
    >
      {label}
      <span className="text-[10px] tabular-nums opacity-70">[{count}]</span>
    </button>
  );
}
