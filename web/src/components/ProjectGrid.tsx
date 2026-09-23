import type { SiteStats } from '../api/stats';
import type { Project } from '../types';
import { EmptyState } from './EmptyState';
import { ProjectCard } from './ProjectCard';
import { SkeletonCard } from './SkeletonCard';

interface ProjectGridProps {
  projects: Project[];
  loading?: boolean;
  skeletonCount?: number;
  onReset?: () => void;
  /** 站点统计，用于算卡片的热力等级；拿不到时为 null */
  stats?: SiteStats | null;
}

/** 响应式项目网格。 */
export function ProjectGrid({
  projects,
  loading = false,
  skeletonCount = 6,
  onReset,
  stats = null,
}: ProjectGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: skeletonCount }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState onAction={onReset} />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, index) => (
        <ProjectCard
          key={project.id}
          project={project}
          index={index}
          stats={stats?.projects[project.id]}
        />
      ))}
    </div>
  );
}
