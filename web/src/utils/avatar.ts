/**
 * 头像地址。
 *
 * GitHub 给每个用户名都提供 `https://github.com/<name>.png` 这个跳转地址，直接返回
 * 头像图片，且不计入匿名接口那 60 次/小时的配额。离线构建产出的 authorAvatar 必然为空，
 * 以前只能等前端调 api.github.com 补齐，配额一耗尽头像就集体消失——所以这里用它兜底，
 * 让头像完全不依赖接口。
 */
export function avatarUrl(authorAvatar: string | undefined, repo: string | undefined) {
  if (authorAvatar) return authorAvatar;
  const owner = (repo ?? '').split('/')[0]?.trim();
  return owner ? `https://github.com/${encodeURIComponent(owner)}.png?size=200` : '';
}
