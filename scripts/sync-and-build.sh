#!/usr/bin/env bash
#
# 把本机仓库同步到远端最新代码，再重建站点（解析 repos/*.md + 打包 web）。
# 由 .github/workflows/deploy.yml 在自托管 runner 调用，也可手动或挂 crontab 轮询：
#
#   bash scripts/sync-and-build.sh
#
# 环境变量：
#   REPO_PATH    仓库绝对路径，默认脚本所在仓库
#   REMOTE       远端名，默认 origin
#   BRANCH       分支名，默认 main
#   FORCE        1/true 时即便代码已最新也强制重建
#   RESTART_CMD  重建完成后执行的命令，例如 "pm2 restart cityu-hub"
#   GITHUB_TOKEN 有则在线解析（补齐 stars / 语言 / 头像），否则离线解析
#
set -euo pipefail

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"

case "${FORCE:-0}" in
  1 | true | TRUE | yes | YES) FORCE_FLAG=1 ;;
  *) FORCE_FLAG=0 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${REPO_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"

log() { printf '[sync %s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() {
  printf '[sync %s] 错误：%s\n' "$(date '+%H:%M:%S')" "$*" >&2
  exit 1
}

[ -n "$REPO_PATH" ] || die "REPO_PATH 为空"
[ -d "$REPO_PATH/.git" ] || die "REPO_PATH 不是 git 仓库：${REPO_PATH}"
for bin in git node npm; do
  command -v "$bin" >/dev/null 2>&1 || die "未找到命令：${bin}"
done

log "仓库 ${REPO_PATH}（${REMOTE}/${BRANCH}）"

before="$(git -C "$REPO_PATH" rev-parse HEAD)"
git -C "$REPO_PATH" fetch --prune "$REMOTE" "$BRANCH" || die "git fetch 失败，检查网络或仓库权限"
target="$(git -C "$REPO_PATH" rev-parse "$REMOTE/$BRANCH")"

if [ "$before" = "$target" ]; then
  if [ "$FORCE_FLAG" -ne 1 ]; then
    log "代码已是最新（${before:0:7}），跳过重建（需要强制重建请设置 FORCE=1）"
    exit 0
  fi
  log "代码已是最新，但 FORCE=1，继续重建"
else
  # 只做快进合并：不会覆盖本机未推送的提交，也不会丢弃未提交的改动
  git -C "$REPO_PATH" merge --ff-only "$target" ||
    die "无法快进到 ${REMOTE}/${BRANCH}（本地有提交分叉或未提交改动），请先手动处理"
  log "代码已更新 ${before:0:7} → ${target:0:7}"
fi

# 根目录是 npm workspaces，一次 npm ci 就装好 repos-parser 与 web 的依赖。
# package-lock.json 没变化时跳过，避免每次定时轮询都重装。
install_deps() {
  local dir="$1" stamp hash
  stamp="$dir/node_modules/.lock-hash"
  if command -v shasum >/dev/null 2>&1; then
    hash="$(shasum -a 256 "$dir/package-lock.json" | awk '{print $1}')"
  else
    hash="$(sha256sum "$dir/package-lock.json" | awk '{print $1}')"
  fi
  if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$hash" ]; then
    log "依赖未变化，跳过 npm ci"
    return 0
  fi
  log "安装依赖（npm ci）"
  (cd "$dir" && npm ci --no-audit --no-fund) || die "npm ci 失败"
  mkdir -p "$dir/node_modules"
  printf '%s' "$hash" >"$stamp"
}

log "重建站点"
install_deps "$REPO_PATH"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  (cd "$REPO_PATH" && npm run build:online) || die "站点构建失败"
  log "在线构建完成（含 stars / 语言 / 头像）"
else
  (cd "$REPO_PATH" && npm run build) || die "站点构建失败"
  log "离线构建完成（stars / 语言 / 头像由前端运行时补齐）"
fi
log "产物已生成于 ${REPO_PATH}/web/dist"

if [ -n "${RESTART_CMD:-}" ]; then
  log "执行重启命令：${RESTART_CMD}"
  (cd "$REPO_PATH" && bash -c "$RESTART_CMD") || die "重启命令失败：${RESTART_CMD}"
fi

log "完成：${target:0:7} 已同步并重建"
