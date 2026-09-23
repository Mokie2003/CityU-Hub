// 首次进入的 head 由构建期预渲染写；这里负责站内路由切换后的同步，
// 否则从项目页返回首页，标题与 canonical 还停在上一个项目上。

// canonical 用绝对地址，避免被判成重复内容
export const SITE_ORIGIN = 'https://cityu-hub.bond';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export interface RouteMeta {
  title: string;
  description: string;
  path: string;
  // 不该被收录的路由（如 404）：只写 noindex，不写 canonical
  noindex?: boolean;
}

export function setRouteMeta({ title, description, path, noindex }: RouteMeta) {
  document.title = title;
  const url = `${SITE_ORIGIN}${path}`;

  setMeta('meta[name="description"]', 'name', 'description', description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', url);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  // 每次切换都重写，否则从 404 回到正常页面会一直带着 noindex
  setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, follow' : 'index, follow');

  // 404 不要 canonical：指向不存在的地址比不写更容易被判成重复内容
  if (noindex) {
    document.head.querySelector('link[rel="canonical"]')?.remove();
    return;
  }

  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}
