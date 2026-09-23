/**
 * 读取聚合统计：GET /api/stats?ids=a,b,c
 *   { uv, clicksTotal, projects: { [id]: { views, clicks } } }
 *
 * ids 由前端传，避免服务端再去扫键。未配置 Redis 时返回全 0，前端照常渲染。
 */
import { redisPipeline, resultAt, upstashConfig } from '../lib/upstash.js';

/** 一次最多查这么多项目，防止有人塞一长串 id 打爆 Redis */
const MAX_IDS = 60;
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  const raw = typeof req.query?.ids === 'string' ? req.query.ids : '';
  const ids = [...new Set(raw.split(',').map((id) => id.trim()).filter((id) => ID_RE.test(id)))].slice(
    0,
    MAX_IDS,
  );

  const empty = { uv: 0, clicksTotal: 0, projects: Object.fromEntries(ids.map((id) => [id, { views: 0, clicks: 0 }])) };

  if (!upstashConfig()) {
    res.status(200).json(empty);
    return;
  }

  const commands = [['PFCOUNT', 'uv:total']];
  for (const id of ids) commands.push(['MGET', `view:${id}`, `click:${id}`]);

  try {
    // 全站点击数另记在一个键上：如果拿「已查询项目的点击之和」当总数，
    // 就会漏掉没查的那些项目，这里直接用独立计数
    commands.push(['GET', 'click:_total_']);
    const payload = await redisPipeline(commands);

    const uv = Number(resultAt(payload, 0, 0));
    const projects = {};
    ids.forEach((id, index) => {
      const values = resultAt(payload, index + 1, [null, null]);
      projects[id] = {
        views: Number(Array.isArray(values) ? (values[0] ?? 0) : 0),
        clicks: Number(Array.isArray(values) ? (values[1] ?? 0) : 0),
      };
    });
    const clicksTotal = Number(resultAt(payload, ids.length + 1, 0));

    res.status(200).json({ uv, clicksTotal, projects });
  } catch (error) {
    res.status(200).json({ ...empty, error: error.message });
  }
}
