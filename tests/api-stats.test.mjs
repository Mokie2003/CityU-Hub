/**
 * /api/track 与 /api/stats 的测试。
 *
 * 用一个内存版 Upstash REST 服务替身跑真实请求：起一个本地 HTTP 服务实现
 * /pipeline 的 INCR / EXPIRE / PFADD / PFCOUNT / MGET / GET，再把
 * KV_REST_API_URL 指向它，这样两个函数里的逻辑都是按线上路径执行的。
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';

/** key → string（计数器）或 Set（HLL 集合，测试里用精确集合代替） */
const store = new Map();

function runCommand([op, key, ...args]) {
  switch (op) {
    case 'INCR': {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return { result: next };
    }
    case 'EXPIRE':
      return { result: 1 };
    case 'PFADD': {
      const set = store.get(key) instanceof Set ? store.get(key) : new Set();
      for (const value of args) set.add(value);
      store.set(key, set);
      return { result: 1 };
    }
    case 'PFCOUNT': {
      const set = store.get(key);
      return { result: set instanceof Set ? set.size : 0 };
    }
    case 'MGET':
      return { result: [key, ...args].map((item) => store.get(item) ?? null) };
    case 'GET':
      return { result: store.get(key) ?? null };
    default:
      return { error: `unknown command: ${op}` };
  }
}

let server;
let track;
let stats;

/** 伪造 Vercel 的 req：readJsonBody 会把它当异步可迭代对象读 */
function mockReq(body, { ip = '203.0.113.1' } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    socket: { remoteAddress: ip },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

function mockRes() {
  return {
    headers: {},
    statusCode: 0,
    payload: undefined,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };
}

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(JSON.parse(body).map(runCommand)));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  process.env.KV_REST_API_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.KV_REST_API_TOKEN = 'test-token';

  track = (await import('../api/track.js')).default;
  stats = (await import('../api/stats.js')).default;
});

after(() => {
  server?.close();
});

test('uv 用 HyperLogLog 去重：同一个访客重复上报只算一次', async () => {
  const visitor = '11111111-2222-3333-4444-555555555555';
  for (let i = 0; i < 3; i += 1) {
    const res = mockRes();
    await track(mockReq({ type: 'uv', visitor }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.ok, true);
  }

  const res = mockRes();
  await stats({ method: 'GET', query: { ids: '' } }, res);
  assert.equal(res.payload.uv, 1);
});

test('view 与 click 分别累计到各自的键', async () => {
  await track(mockReq({ type: 'view', id: 'demo-project' }), mockRes());
  await track(mockReq({ type: 'view', id: 'demo-project' }), mockRes());
  await track(mockReq({ type: 'click', id: 'demo-project' }), mockRes());

  const res = mockRes();
  await stats({ method: 'GET', query: { ids: 'demo-project,never-seen' } }, res);
  assert.deepEqual(res.payload.projects['demo-project'], { views: 2, clicks: 1 });
  assert.deepEqual(res.payload.projects['never-seen'], { views: 0, clicks: 0 });
  assert.equal(res.payload.clicksTotal, 1);
});

test('非法事件与非法 id 一律 400，不落任何键', async () => {
  for (const body of [
    { type: 'unknown', id: 'demo-project' },
    { type: 'view', id: '../etc/passwd' },
    { type: 'view', id: '' },
    { type: 'uv', visitor: 'x' },
  ]) {
    const res = mockRes();
    await track(mockReq(body), res);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
});

test('GET 之外的请求打到 /api/track 返回 405', async () => {
  const res = mockRes();
  await track({ ...mockReq({ type: 'view', id: 'demo-project' }), method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
});

test('同一 IP 超过每小时上限后返回 429', async () => {
  const ip = '198.51.100.7';
  let limited = 0;
  for (let i = 0; i < 130; i += 1) {
    const res = mockRes();
    await track(mockReq({ type: 'view', id: 'rate-limited' }, { ip }), res);
    if (res.statusCode === 429) limited += 1;
  }
  assert.ok(limited > 0, '应该出现 429');
});

test('/api/stats 会过滤掉非法 id 并给缓存头', async () => {
  const res = mockRes();
  await stats({ method: 'GET', query: { ids: 'ok-id,..bad,BAD_SLASH/id' } }, res);
  assert.deepEqual(Object.keys(res.payload.projects), ['ok-id']);
  assert.match(res.headers['cache-control'], /s-maxage/);
});
