import { useMemo } from 'react';
import type { Project, SortKey } from '../types';
import { parseQuery, type ParsedQuery } from '../utils/searchParser';

/** 匹配权重：项目名 > 标签 > 描述/分类 */
const WEIGHT = {
  name: 3,
  tag: 2,
  other: 1,
  none: 0,
} as const;

function matchesQualifiers(project: Project, qualifiers: ParsedQuery['qualifiers']): boolean {
  const { author, tag, lang, category } = qualifiers;
  if (author && project.author.toLowerCase() !== author.toLowerCase()) return false;
  if (lang && project.language.toLowerCase() !== lang.toLowerCase()) return false;
  if (category && project.category.toLowerCase() !== category.toLowerCase()) return false;
  if (tag && !project.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return false;
  return true;
}

function termScore(project: Project, term: string): number {
  if (project.name.toLowerCase().includes(term)) return WEIGHT.name;
  if (project.tags.some((tag) => tag.toLowerCase().includes(term))) return WEIGHT.tag;
  if (
    project.description.toLowerCase().includes(term) ||
    project.category.toLowerCase().includes(term)
  ) {
    return WEIGHT.other;
  }
  return WEIGHT.none;
}

function compareBy(sort: SortKey, a: Project, b: Project): number {
  switch (sort) {
    case 'stars':
      return b.stars - a.stars;
    case 'name':
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    case 'updated':
    default:
      return b.updatedAt.localeCompare(a.updatedAt);
  }
}

/**
 * 先按限定符（author/tag/lang/category）过滤，再对自由文本做多字段模糊匹配，
 * 最后按「完全匹配 name > 匹配 tags > 匹配 description」排序。
 */
export function useSearch(projects: Project[], query: string, sort: SortKey = 'updated'): Project[] {
  return useMemo(() => {
    const { qualifiers, freeText } = parseQuery(query);
    const terms = freeText.toLowerCase().split(/\s+/).filter(Boolean);

    const scored: Array<{ project: Project; score: number }> = [];

    for (const project of projects) {
      if (!matchesQualifiers(project, qualifiers)) continue;

      let score = 0;
      if (terms.length > 0) {
        let matched = true;
        for (const term of terms) {
          const weight = termScore(project, term);
          if (weight === WEIGHT.none) {
            matched = false;
            break;
          }
          score += weight;
        }
        if (!matched) continue;
      }

      scored.push({ project, score });
    }

    scored.sort((a, b) => b.score - a.score || compareBy(sort, a.project, b.project));

    return scored.map((item) => item.project);
  }, [projects, query, sort]);
}
