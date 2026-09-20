import { useCallback, useEffect, useState } from 'react';
import { fetchProjectById, fetchProjects } from '../api/projects';
import type { Project, ProjectsResponse } from '../types';

interface ProjectsState {
  data: ProjectsResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** 首页数据：项目列表 + 聚合信息 */
export function useProjects(): ProjectsState {
  const [data, setData] = useState<ProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchProjects()
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : '数据加载失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}

interface ProjectState {
  project: Project | null;
  loading: boolean;
  error: string | null;
}

/** 详情页数据：按需加载单个项目（含 readmeHtml） */
export function useProject(id: string | undefined): ProjectState {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProject(null);
      setError('缺少项目 id');
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    fetchProjectById(id)
      .then((res) => {
        if (alive) setProject(res);
      })
      .catch((err: unknown) => {
        if (alive) {
          setProject(null);
          setError(err instanceof Error ? err.message : '数据加载失败');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  return { project, loading, error };
}
