/** POST /api/track 埋点，type 为 uv / view / click；uv 用 HyperLogLog 去重，只做匿名计数 */
import { createHash } from 'node:crypto';
import { readJsonBody, redisPipeline, resultAt, upstashConfig } from '../lib/upstash.js';

/** 与解析器产出的 id 同一套字符集 */
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
/** 前端 crypto.randomUUID() 生成，宽松校验即可 */
const VISITOR_RE = /^[A-Za-z0-9-]{8,64}$/;
/** 单 IP 每小时上报上限，防刷热度 */
const RATE_LIMIT = 120;
const RATE_WINDOW_SECONDS = 3600;
/** 日 UV 键保留 90 天 */
const DAY_TTL_SECONDS = 90 * 24 * 3600;

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

/** 限流键里不放明文 IP */
function clientKey(req) {
  return createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }
  // 没配 Redis 就静默跳过，不在页面上报错
  if (!upstashConfig()) {
    res.status(200).json({ ok: false, error: 'stats-disabled' });
    return;
  }

  const body = await readJsonBody(req);
  const type = body?.type;
  const id = typeof body?.id === 'string' ? body.id : '';
  const visitor = typeof body?.visitor === 'string' ? body.visitor : '';

  const commands = [];
  if (type === 'uv' && VISITOR_RE.test(visitor)) {
    const day = new Date().toISOString().slice(0, 10);
    commands.push(['PFADD', 'uv:total', visitor]);
    commands.push(['PFADD', `uv:day:${day}`, visitor], ['EXPIRE', `uv:day:${day}`, DAY_TTL_SECONDS]);
  } else if ((type === 'view' || type === 'click') && ID_RE.test(id)) {
    commands.push(['INCR', `${type}:${id}`]);
    // 全站点击另记一份；键以 _ 开头，合法 id 必以字母数字开头，不会撞
    if (type === 'click') commands.push(['INCR', 'click:_total_']);
  } else {
    res.status(400).json({ ok: false, error: 'bad-request' });
    return;
  }

  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const rateKey = `rate:${clientKey(req)}:${bucket}`;
  commands.push(['INCR', rateKey], ['EXPIRE', rateKey, RATE_WINDOW_SECONDS]);
  const rateIndex = commands.length - 2;

  try {
    const payload = await redisPipeline(commands);
    const used = Number(resultAt(payload, rateIndex, 0));
    if (used > RATE_LIMIT) {
      res.status(429).json({ ok: false, error: 'rate-limited' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    // 写失败不影响用户，前端是 fire-and-forget
    res.status(200).json({ ok: false, error: error.message });
  }
}
