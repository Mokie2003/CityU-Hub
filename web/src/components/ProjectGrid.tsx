import type { Project } from '../types';
import { EmptyState } from './EmptyState';
import { ProjectCard } from './ProjectCard';
import { SkeletonCard } from './SkeletonCard';

interface ProjectGridProps {
  projects: Project[];
  loading?: boolean;
  skeletonCount?: number;
  onReset?: () => void;
}

/** 响应式网格：≥1280px 三列 / ≥640px 两列 / 移动端一列 */
export function ProjectGrid({
  projects,
  loading = false,
  skeletonCount = 6,
  onReset,
}: ProjectGridProps) {
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, index) => (
        <ProjectCard key={project.id} project={project} index={index} />
      ))}
    </div>
  );
}
