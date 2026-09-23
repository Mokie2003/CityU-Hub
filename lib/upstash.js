/**
 * Upstash Redis 的极简 REST 客户端（只用到 pipeline）。不引 @upstash/redis，
 * 直接 fetch 打 REST，少一个依赖少一处构建风险。
 * 环境变量两种接入都认：Vercel 的 Upstash 集成给 KV_REST_API_*，
 * 自建库给 UPSTASH_REDIS_REST_URL/TOKEN。没配就返回 null 让调用方降级，
 * 统计不可用不能拖垮站点。
 */

const URL_KEYS = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL', 'REDIS_REST_API_URL'];
const TOKEN_KEYS = ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN', 'REDIS_REST_API_TOKEN'];

function firstDefined(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value.replace(/\/+$/, '');
  }
  return '';
}

export function upstashConfig() {
  const url = firstDefined(URL_KEYS);
  const token = firstDefined(TOKEN_KEYS);
  return url && token ? { url, token } : null;
}

/** 执行一组 Redis 命令，commands 形如 [['PFADD','uv:total','x'], ...]；未配置时返回 null */
export async function redisPipeline(commands) {
  const config = upstashConfig();
  if (!config) return null;

  const res = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Upstash 返回 HTTP ${res.status}`);
  return res.json();
}

export function resultAt(payload, index, fallback = 0) {
  const item = Array.isArray(payload) ? payload[index] : null;
  if (!item || item.error) return fallback;
  return item.result ?? fallback;
}

/** 读取请求体（Vercel 的 Node 函数不会自动解析 JSON） */
export async function readJsonBody(req, limitBytes = 2048) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}
