import type { AuthorItem } from '../types';

/**
 * 站内贡献者墙。
 *
 * README 上那份名单只有去 GitHub 才看得到，这里再呈现一次并直达作者主页——
 * 「名字会被记录下来」这件事要让人在站内就看见，投稿激励才成立。
 */
export function ContributorWall({ authors }: { authors: AuthorItem[] }) {
  if (authors.length === 0) return null;

  return (
    <section className="panel-brutal p-5">
      <h2 className="pixel flex items-center gap-2 text-[9px] text-muted">
        <span className="size-3 shrink-0 bg-brand" />
        贡献者 · {authors.length}
      </h2>
      <p className="mono mt-2 text-[11px] text-muted">
        这些同学的仓库已被收录，点击头像去他们的 GitHub 主页看看。
      </p>

      <ul className="mt-4 flex flex-wrap gap-2.5">
        {authors.map((author) => {
          const githubUser = author.githubUser || author.name;
          return (
            <li key={author.name}>
              <a
                href={`https://github.com/${encodeURIComponent(githubUser)}`}
                target="_blank"
                rel="noreferrer noopener"
                title={`@${githubUser} 的 GitHub 主页`}
                className="flex items-center gap-2 border-2 border-line px-2 py-1.5 transition-colors hover:border-brand hover:text-brand"
              >
                {author.avatar ? (
                  <img
                    src={author.avatar}
                    alt=""
                    loading="lazy"
                    width={24}
                    height={24}
                    className="size-6 shrink-0 border-2 border-line bg-elevated object-cover"
                  />
                ) : (
                  <span className="pixel grid size-6 shrink-0 place-items-center border-2 border-line bg-elevated text-[7px] text-ink uppercase">
                    {author.name.slice(0, 1)}
                  </span>
                )}
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="mono truncate text-[11px] text-ink">{author.name}</span>
                  {author.realName && author.realName !== author.name && (
                    <span className="mono truncate text-[10px] text-muted">{author.realName}</span>
                  )}
                </span>
                <span className="mono shrink-0 text-[10px] text-muted">[{author.count}]</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
