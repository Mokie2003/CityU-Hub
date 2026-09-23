// 离线构建产出的 authorAvatar 必为空，github.com/<name>.png 不吃 api.github.com 那 60 次/小时的配额，用它兜底。
export function avatarUrl(authorAvatar: string | undefined, repo: string | undefined) {
  if (authorAvatar) return authorAvatar;
  const owner = (repo ?? '').split('/')[0]?.trim();
  return owner ? `https://github.com/${encodeURIComponent(owner)}.png?size=200` : '';
}
