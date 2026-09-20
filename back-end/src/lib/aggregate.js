export function aggregateProjects(projects) {
  const countValues = (values) => {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };

  const active = projects.filter((project) => project.status === 'active');
  const tags = countValues(active.flatMap((project) => project.tags));
  const authors = countValues(active.map((project) => project.author));
  const categories = countValues(active.map((project) => project.category));

  return {
    tags,
    authors,
    categories,
    stats: {
      total: projects.length,
      active: active.length,
      featured: active.filter((project) => project.featured).length,
      withReadme: active.filter((project) => project.content).length,
      languages: countValues(active.map((project) => project.language || '未知')),
      builtAt: new Date().toISOString(),
    },
  };
}
