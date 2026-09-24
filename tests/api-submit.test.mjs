/**
 * /api/submit 的测试：起本地 HTTP 服务顶替 Upstash（/pipeline）与 GitHub REST，
 * 把 KV_REST_API_URL 和 GITHUB_API_URL 都指过去，函数就能按线上路径执行。
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';

const REPO_PREFIX = '/repos/Warpshlczy/CityU-Hub';
const PR_URL = 'https://github.com/Warpshlczy/CityU-Hub/pull/99';

/** 限流计数器：key → 次数 */
const counters = new Map();

/** 假 GitHub 记录下来的调用 */
const github = {
  /** feature 分支上已存在的文件路径 */
  files: new Set(),
  branches: [],
  contents: {},
  pulls: [],
  deleted: [],
  failPulls: false,
};

function resetGithub() {
  github.files.clear();
  github.branches.length = 0;
  github.pulls.length = 0;
  github.deleted.length = 0;
  github.failPulls = false;
  for (const key of Object.keys(github.contents)) delete github.contents[key];
}

function send(res, status, data) {
  if (data === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
  });
}

async function route(req, res) {
  const raw = await readBody(req);
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = url.pathname;

  if (path === '/pipeline') return handlePipeline(res, raw);
  if (!path.startsWith(REPO_PREFIX)) return send(res, 404, { message: 'Not Found' });
  return handleGithub(req, res, raw, path.slice(REPO_PREFIX.length));
}

function handlePipeline(res, raw) {
  const payload = JSON.parse(raw).map(([op, key]) => {
    if (op !== 'INCR') return { result: 1 };
    const next = Number(counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    return { result: next };
  });
  send(res, 200, payload);
}

function handleGithub(req, res, raw, rest) {
  if (rest === '/git/ref/heads/feature') return send(res, 200, { object: { sha: 'base-sha' } });

  const contents = /^\/contents\/(.+)$/.exec(rest);
  if (contents && req.method === 'GET') {
    const filePath = decodeURIComponent(contents[1]);
    return github.files.has(filePath)
      ? send(res, 200, { path: filePath, sha: 'existing' })
      : send(res, 404, { message: 'Not Found' });
  }

  if (contents && req.method === 'POST') {
    const filePath = decodeURIComponent(contents[1]);
    const payload = JSON.parse(raw);
    github.contents[filePath] = Buffer.from(payload.content, 'base64').toString('utf8');
    return send(res, 201, { content: { path: filePath } });
  }

  if (rest === '/git/refs' && req.method === 'POST') {
    const payload = JSON.parse(raw);
    github.branches.push(payload.ref);
    return send(res, 201, { ref: payload.ref, object: { sha: payload.sha } });
  }

  if (rest === '/pulls' && req.method === 'POST') {
    if (github.failPulls) return send(res, 422, { message: 'Validation Failed' });
    github.pulls.push(JSON.parse(raw));
    return send(res, 201, { number: 99, html_url: PR_URL });
  }

  const branch = /^\/git\/refs\/heads\/(.+)$/.exec(rest);
  if (branch && req.method === 'DELETE') {
    github.deleted.push(decodeURIComponent(branch[1]));
    return send(res, 204);
  }

  send(res, 404, { message: 'Not Found' });
}

/** 伪造 Vercel req：readJsonBody 按异步可迭代对象读它，所以要带 Symbol.asyncIterator */
function mockReq(body, { ip = '203.0.113.1', method = 'POST' } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  return {
    method,
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

const CONTENT = [
  '---',
  'title: "Demo Project"',
  'author: "demo-user"',
  'authorName: "示例同学"',
  'major: "Computer Science"',
  'enrollmentYear: 2024',
  'repoUrl: "https://github.com/demo-user/demo-project"',
  '---',
  '',
  '一个用来测试提交接口的项目。',
].join('\n');

function submission(overrides = {}) {
  return { fileName: 'repos/demo-project.md', content: CONTENT, ...overrides };
}

let server;
let submit;

before(async () => {
  server = http.createServer((req, res) => {
    route(req, res).catch((error) => {
      send(res, 500, { message: error.message });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.KV_REST_API_URL = origin;
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.GITHUB_API_URL = origin;
  process.env.SUBMIT_GITHUB_TOKEN = 'test-github-token';
  // 用例之间互不影响，计数器每次从头算
  counters.clear();

  submit = (await import('../api/submit.js')).default;
});

after(() => {
  server?.close();
});

test('提交成功会建分支、写文件、开 PR，返回 PR 链接', async () => {
  resetGithub();
  const res = mockRes();
  await submit(mockReq(submission(), { ip: '198.51.100.11' }), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.url, PR_URL);
  assert.equal(res.payload.number, 99);

  assert.equal(github.branches.length, 1);
  assert.match(github.branches[0], /^refs\/heads\/submit\/demo-project-[0-9a-f]{6}$/);
  const branch = github.branches[0].replace('refs/heads/', '');

  // 文件内容原样写进刚建的分支
  assert.deepEqual(github.contents, { 'repos/demo-project.md': CONTENT });

  const pr = github.pulls[0];
  assert.equal(pr.head, branch);
  assert.equal(pr.base, 'feature');
  assert.match(pr.title, /Demo Project/);
  assert.match(pr.body, /demo-user/);
});

test('文件名与 front matter 不合法的一律 400，且不碰 GitHub', async () => {
  resetGithub();
  const cases = [
    [{ fileName: 'repos/../api/submit.js' }, /文件名不合法/],
    [{ fileName: 'repos/../../evil.md' }, /文件名不合法/],
    [{ fileName: 'repos/demo project.md' }, /文件名不合法/],
    [{ fileName: 'demo-project.md' }, /文件名不合法/],
    [{ content: 'no front matter' }, /front matter/],
    [{ content: CONTENT.replace('title: "Demo Project"\n', '') }, /缺少 title/],
    [{ content: CONTENT.replace(/enrollmentYear: \d+/, 'enrollmentYear: 1800') }, /2000/],
    [
      { content: CONTENT.replace('https://github.com/demo-user/demo-project', 'https://gitlab.com/a/b') },
      /repoUrl/,
    ],
  ];

  for (const [overrides, message] of cases) {
    const res = mockRes();
    await submit(mockReq(submission(overrides), { ip: '198.51.100.12' }), res);
    assert.equal(res.statusCode, 400, JSON.stringify(overrides));
    assert.match(res.payload.message, message, JSON.stringify(overrides));
  }

  assert.equal(github.branches.length, 0);
  assert.deepEqual(github.pulls, []);
});

test('目标文件已存在时返回 409，不覆盖也不建分支', async () => {
  resetGithub();
  github.files.add('repos/demo-project.md');

  const res = mockRes();
  await submit(mockReq(submission(), { ip: '198.51.100.13' }), res);

  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /已经存在/);
  assert.equal(github.branches.length, 0);
});

test('开 PR 失败时把刚建的分支删掉，不在仓库里留空分支', async () => {
  resetGithub();
  github.failPulls = true;

  const res = mockRes();
  await submit(mockReq(submission(), { ip: '198.51.100.14' }), res);

  assert.equal(res.statusCode, 502);
  assert.match(res.payload.message, /创建 PR 失败/);
  assert.equal(github.deleted.length, 1);
  assert.equal(github.deleted[0], github.branches[0].replace('refs/heads/', ''));
});

test('同一 IP 每小时最多开 5 个 PR，之后返回 429', async () => {
  resetGithub();
  const ip = '198.51.100.20';
  const codes = [];
  for (let i = 0; i < 7; i += 1) {
    const res = mockRes();
    await submit(mockReq(submission(), { ip }), res);
    codes.push(res.statusCode);
  }

  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429, 429]);
});

test('没配 token 时返回 submit-disabled，让前端回退到 GitHub 流程', async () => {
  const token = process.env.SUBMIT_GITHUB_TOKEN;
  delete process.env.SUBMIT_GITHUB_TOKEN;
  try {
    const res = mockRes();
    await submit(mockReq(submission(), { ip: '198.51.100.15' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.error, 'submit-disabled');
  } finally {
    process.env.SUBMIT_GITHUB_TOKEN = token;
  }
});

test('没配 Redis 时同样返回 submit-disabled，不放不设防的写接口出去', async () => {
  const url = process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_URL;
  try {
    const res = mockRes();
    await submit(mockReq(submission(), { ip: '198.51.100.16' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.error, 'submit-disabled');
  } finally {
    process.env.KV_REST_API_URL = url;
  }
});

test('GET 之外的请求打到 /api/submit 返回 405', async () => {
  const res = mockRes();
  await submit({ ...mockReq(undefined), method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
});