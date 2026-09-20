import { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
import type { Project } from '../types';
import { formatNumber, formatRelativeTime } from '../utils/formatNumber';
import { languageColor } from '../utils/language';
import { GitHubIcon } from './GitHubIcon';
import { TagChips } from './TagChips';

interface ProjectCardProps {
  project: Project;
  /** 用于 stagger 入场动画与像素编号 [01] */
  index: number;
}

/** 卡片内容：作者 → 项目名 → 描述 → 标签 → 语言/star/更新时间 */
export const ProjectCard = memo(function ProjectCard({ project, index }: ProjectCardProps) {
  const navigate = useNavigate();
  const detailUrl = `/project/${project.id}`;
  const delay = Math.min(index * 40, 400);

  return (
    <article
      onClick={() => navigate(detailUrl)}
      style={{ animationDelay: `${delay}ms` }}
      className="card-brutal cursor-target animate-fade-in-up group flex flex-col p-5"
    >
      <div className="flex items-center gap-2">
        <img
          src={project.authorAvatar}
          alt={`${project.author} 的头像`}
          loading="lazy"
          width={24}
          height={24}
          className="size-6 border-2 border-line object-cover bg-elevated"
        />
        <span className="mono text-[11px] text-muted">{project.author}</span>
        {project.demoUrl && (
          <span className="pixel border-2 border-accent px-1.5 py-1 text-[7px] text-accent">
            DEMO
          </span>
        )}
        <span className="pixel ml-auto text-[10px] text-muted">
          [{String(index + 1).padStart(2, '0')}]
        </span>
      </div>

      <h3 className="mt-3 text-lg font-black tracking-tight text-ink transition-colors group-hover:text-brand">
        <Link to={detailUrl} onClick={(event) => event.stopPropagation()} className="focus-visible:outline-none">
          {project.name}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-2 min-h-10 text-[13px] leading-5 text-muted">
        {project.description}
      </p>

      <div className="mt-3">
        <TagChips items={project.tags} max={3} size="sm" />
      </div>

      <div className="mono mt-4 flex items-center gap-3 border-t-[3px] border-line pt-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 border border-line"
            style={{ backgroundColor: languageColor(project.language) }}
          />
          {project.language}
        </span>
        <span className="flex items-center gap-1 text-brand">
          <Star className="size-3.5" />
          <span className="tabular-nums">{formatNumber(project.stars)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" />
          {formatRelativeTime(project.updatedAt)}
        </span>
        <a
          href={project.githubUrl}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(event) => event.stopPropagation()}
          aria-label={`打开 ${project.name} 的 GitHub 仓库`}
          className="ml-auto grid size-7 place-items-center border-2 border-line text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <GitHubIcon className="size-3.5" />
        </a>
      </div>
    </article>
  );
});
