/** 标签 / 作者 / 分类的出现次数，按次数倒序，次数相同按名称排序 */
function countValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function aggregateProjects(projects) {
  return {
    tags: countValues(projects.flatMap((project) => project.tags)),
    authors: countValues(projects.map((project) => project.author)),
    categories: countValues(projects.map((project) => project.category)),
  };
}
