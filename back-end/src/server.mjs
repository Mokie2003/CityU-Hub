import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdownHtml } from './lib/markdown.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(process.env.OUTPUT_DIR ?? path.join(backendRoot, 'output'));
const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '127.0.0.1';

async function readJson(fileName, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(outputDir, fileName), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function toProject(project) {
  return {
    id: project.id,
    name: project.title,
    author: project.author,
    authorName: project.authorName,
    major: project.major,
    enrollmentYear: project.enrollmentYear,
    authorAvatar: project.authorAvatar ?? '',
    repo: project.repoUrl.replace('https://github.com/', ''),
    description: project.description || project.summary || '',
    tags: project.tags ?? [],
    category: project.category,
    githubUrl: project.repoUrl,
    demoUrl: project.homepageUrl || null,
    stars: project.stars ?? 0,
    forks: project.forks ?? 0,
    language: project.language ?? '',
    license: project.license ?? '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

async function getProjectsResponse() {
  const [projects, tags, authors, categories, stats] = await Promise.all([
    readJson('projects.json', []),
    readJson('tags.json', []),
    readJson('authors.json', []),
    readJson('categories.json', []),
    readJson('stats.json', {}),
  ]);
  return {
    generatedAt: stats.builtAt ?? '',
    total: projects.length,
    projects: projects.map(toProject),
    tags,
    authors,
    categories,
  };
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify(value));
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host ?? host}`);
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method Not Allowed' });
    return;
  }
  if (url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }
  if (url.pathname === '/projects') {
    sendJson(response, 200, await getProjectsResponse());
    return;
  }
  const detailMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
  if (detailMatch) {
    const project = await readJson(`projects/${decodeURIComponent(detailMatch[1])}.json`, null);
    if (!project) {
      sendJson(response, 404, { error: 'Project not found' });
      return;
    }
    sendJson(response, 200, { ...toProject(project), readmeHtml: renderMarkdownHtml(project.content) });
    return;
  }
  sendJson(response, 404, { error: 'Not Found' });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error('[server]', error);
    sendJson(response, 500, { error: 'Internal Server Error' });
  });
});

server.listen(port, host, () => {
  console.log(`CityU-Hub API listening at http://${host}:${port}`);
});