/**
 * 站点统计的读写。
 *
 * 隐私取舍：不写 cookie、不引入第三方脚本；访客标识是 crypto.randomUUID() 后存在
 * 本地，服务端只用它做 HyperLogLog 去重。浏览器开了 Do Not Track 时完全不上报。
 */

export interface ProjectStats {
  views: number;
  clicks: number;
}

export interface SiteStats {
  uv: number;
  clicksTotal: number;
  projects: Record<string, ProjectStats>;
}

const VISITOR_KEY = 'cityu-hub:visitor';
const UV_SESSION_KEY = 'cityu-hub:uv-sent';

/** 匿名访客标识：只存在本机 */
function visitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return '';
  }
}

/** 尊重 Do Not Track */
function trackingAllowed() {
  const dnt = navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack;
  return !(dnt === '1' || dnt === 'yes');
}

function send(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    // 跳转外链时页面可能正在卸载，beacon 比 fetch 可靠
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/track', {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    /* 埋点失败不影响浏览 */
  }
}

/** 每个会话上报一次 UV（HLL 天然去重，重复上报也不会虚高） */
export function trackVisit() {
  if (!trackingAllowed()) return;
  try {
    if (window.sessionStorage.getItem(UV_SESSION_KEY) === '1') return;
    window.sessionStorage.setItem(UV_SESSION_KEY, '1');
  } catch {
    /* sessionStorage 不可用时仍然上报一次 */
  }
  const visitor = visitorId();
  if (visitor) send({ type: 'uv', visitor });
}

/** 详情页浏览与外链点击 */
export function trackProjectEvent(type: 'view' | 'click', id: string) {
  if (!trackingAllowed() || !id) return;
  send({ type, id });
}

let cache: { key: string; data: SiteStats } | null = null;

/** 拉取聚合统计；接口不可用（本地开发、未配 Redis）时返回 null，前端照常渲染 */
export async function fetchStats(ids: string[]): Promise<SiteStats | null> {
  const key = [...ids].sort().join(',');
  if (cache && cache.key === key) return cache.data;

  try {
    const res = await fetch(`/api/stats?ids=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as SiteStats;
    cache = { key, data };
    return data;
  } catch {
    return null;
  }
}
