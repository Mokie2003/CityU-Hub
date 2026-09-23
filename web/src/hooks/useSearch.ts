import { useMemo } from 'react';
import type { Project, SortKey } from '../types';
import { parseQuery, type Qualifiers } from '../utils/searchParser';

/** 模糊匹配权重：项目名 > 标签 > 作者 > 描述/分类/语言 */
const WEIGHT = {
  exactName: 10,
  name: 6,
  exactTag: 4,
  tag: 3,
  author: 2,
  description: 1,
  other: 1,
  none: 0,
} as const;

const lower = (value: string | undefined) => (value ?? '').toLowerCase();

/**
 * 限定符筛选规则：
 * - 不同限定符之间是「与」：`author:alice lang:Python` 两个条件都要满足
 * - `tag:` 可以写多个，同样是「与」：`tag:NLP tag:情感分析` 表示两个标签都要有
 * - `author:` / `lang:` / `category:` 都是单值字段，写多个时按「任意一个命中」处理
 * - `author:` 同时匹配 GitHub 用户名与作者实名
 */
function matchesQualifiers(project: Project, qualifiers: Qualifiers): boolean {
  const authors = qualifiers.author.map((value) => value.toLowerCase());
  if (authors.length > 0) {
    const names = [lower(project.author), lower(project.authorName)];
    if (!authors.some((value) => names.includes(value))) return false;
  }

  const languages = qualifiers.lang.map((value) => value.toLowerCase());
  if (languages.length > 0 && !languages.includes(lower(project.language))) return false;

  const categories = qualifiers.category.map((value) => value.toLowerCase());
  if (categories.length > 0 && !categories.includes(lower(project.category))) return false;

  return qualifiers.tag.every((tag) =>
    project.tags.some((item) => item.toLowerCase() === tag.toLowerCase()),
  );
}

/** 自由文本的模糊匹配：全部关键词都要命中，命中位置越靠前分越高 */
function termScore(project: Project, term: string): number {
  const name = lower(project.name);
  if (name === term) return WEIGHT.exactName;
  if (name.includes(term)) return WEIGHT.name;

  if (project.tags.some((tag) => lower(tag) === term)) return WEIGHT.exactTag;
  if (project.tags.some((tag) => lower(tag).includes(term))) return WEIGHT.tag;

  if (`${lower(project.author)} ${lower(project.authorName)}`.includes(term)) return WEIGHT.author;
  if (lower(project.description).includes(term)) return WEIGHT.description;

  if (
    lower(project.category).includes(term) ||
    lower(project.language).includes(term) ||
    lower(project.repo).includes(term)
  ) {
    return WEIGHT.other;
  }

  return WEIGHT.none;
}

function compareBy(
  sort: SortKey,
  a: Project,
  b: Project,
  heatScores?: Map<string, number>,
): number {
  switch (sort) {
    case 'heat':
      // 热力值由调用方算好（要等站内统计到位），拿不到时退回按 star 排
      return (heatScores?.get(b.id) ?? 0) - (heatScores?.get(a.id) ?? 0) || b.stars - a.stars;
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
 * 先按限定符过滤，再对自由文本做多字段模糊匹配，最后按匹配度 + 排序方式排序。
 * `xx:xx xx:xx` 同时匹配；只有 `xx` 时按全文模糊匹配。
 */
export function useSearch(
  projects: Project[],
  query: string,
  sort: SortKey = 'updated',
  /** 项目 id → 热力值，按热度排序时用 */
  heatScores?: Map<string, number>,
): Project[] {
  return useMemo(() => {
    const { qualifiers, terms } = parseQuery(query);

    const scored: Array<{ project: Project; score: number }> = [];

    for (const project of projects) {
      if (!matchesQualifiers(project, qualifiers)) continue;

      let score = 0;
      let matchedAll = true;
      for (const term of terms) {
        const weight = termScore(project, term);
        if (weight === WEIGHT.none) {
          matchedAll = false;
          break;
        }
        score += weight;
      }
      if (!matchedAll) continue;

      scored.push({ project, score });
    }

    scored.sort((a, b) => b.score - a.score || compareBy(sort, a.project, b.project, heatScores));

    return scored.map((item) => item.project);
  }, [projects, query, sort, heatScores]);
}
