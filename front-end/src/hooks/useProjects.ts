import { useCallback, useEffect, useState } from 'react';
import { enrichProjectsWithGithub } from '../api/github';
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
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const res = await fetchProjects();
        if (!alive) return;
        setData(res);
        setLoading(false);

        // 列表先渲染，缺失的语言 / stars 再异步从 GitHub 补齐
        const enriched = await enrichProjectsWithGithub(res.projects, controller.signal);
        if (alive && enriched) {
          setData((prev) => (prev ? { ...prev, projects: enriched } : prev));
        }
      } catch (err: unknown) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : '数据加载失败');
        setLoading(false);
      }
    };
    run();

    return () => {
      alive = false;
      controller.abort();
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
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const res = await fetchProjectById(id);
        if (!alive) return;
        setProject(res);
        setLoading(false);

        const enriched = await enrichProjectsWithGithub([res], controller.signal);
        if (alive && enriched) setProject(enriched[0]);
      } catch (err: unknown) {
        if (!alive) return;
        setProject(null);
        setError(err instanceof Error ? err.message : '数据加载失败');
        setLoading(false);
      }
    };
    run();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [id]);

  return { project, loading, error };
}
