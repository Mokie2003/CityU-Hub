import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateProjects } from './lib/aggregate.js';
import { createGithubClient, parseRepoUrl } from './lib/github.js';
import { analyzeReadme, guessTagsFromReadme } from './lib/markdown.js';
import { slugify } from './lib/slug.js';
import { loadConfig } from './config.js';
import { parseFrontmatterDocument } from './lib/frontmatter.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(backendRoot, '..');
const reposDir = path.resolve(process.env.REPOS_DIR ?? path.join(projectRoot, 'repos'));
const outputDir = path.resolve(process.env.OUTPUT_DIR ?? path.join(backendRoot, 'output'));
const offline = process.argv.includes('--offline');

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function canonicalRepoUrl(url) {
  return url.toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '');
}

function buildSearchIndex(projects) {
  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    summary: project.summary,
    author: project.author,
    category: project.category,
    language: project.language,
    tags: project.tags,
    status: project.status,
    searchableText: [
      project.title,
      project.summary,
      project.description,
      project.author,
      project.category,
      project.language,
      project.tags.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }));
}

async function enrichProject(meta, content, fileName, github, useOffline) {
  const ref = parseRepoUrl(meta.repoUrl);
  if (!ref) throw new Error(`${fileName}: repoUrl 不是可识别的 GitHub 仓库地址`);

  let githubMeta = null;
  if (!useOffline) githubMeta = await github.fetchRepoMeta(ref);

  const analysis = analyzeReadme(content);
  const tags = [
    ...new Set([
      ...meta.tags,
      ...(githubMeta?.topics ?? []),
      ...guessTagsFromReadme(content, { language: githubMeta?.language }),
    ]),
  ].slice(0, 12);
  const id = meta.id || slugify(`${ref.owner}-${ref.repo}`);
  const now = new Date().toISOString();

  return {
    id,
    title: meta.title || analysis.title || githubMeta?.repo || ref.repo,
    summary: meta.summary || analysis.summary || githubMeta?.description || '',
    description: githubMeta?.description || '',
    repoUrl: ref.repoUrl,
    homepageUrl: meta.homepageUrl || githubMeta?.homepageUrl || '',
    coverImage: analysis.firstImage?.url || '',
    author: meta.author || githubMeta?.owner || ref.owner,
    authorName: meta.authorName,
    major: meta.major,
    enrollmentYear: meta.enrollmentYear,
    source: 'github',
    tags,
    category: meta.category,
    language: githubMeta?.language || '',
    stars: githubMeta?.stars || 0,
    readmeFile: fileName,
    readmeTitle: analysis.title,
    readmeHtmlUrl: githubMeta ? `${ref.repoUrl}/blob/${githubMeta.defaultBranch}/README.md` : '',
    readmeFetchedAt: null,
    pushedAt: githubMeta?.pushedAt || null,
    license: githubMeta?.license || null,
    archived: Boolean(githubMeta?.archived),
    featured: meta.featured,
    status: meta.status,
    createdAt: now,
    updatedAt: now,
    sourceFile: path.posix.join('repos', fileName),
    readmeUrl: `/data/projects/${id}.json`,
    content,
    analysis,
  };
}

export async function buildIndex({ inputDir = reposDir, outputPath = outputDir, useOffline = offline } = {}) {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_template.md')
    .map((entry) => entry.name)
    .sort();
  const config = loadConfig();
  const github = createGithubClient(config);
  const projects = [];
  const ids = new Map();
  const repoUrls = new Map();

  for (const fileName of files) {
    const source = await fs.readFile(path.join(inputDir, fileName), 'utf8');
    const { meta, body } = parseFrontmatterDocument(source, fileName);
    const project = await enrichProject(meta, body, fileName, github, useOffline);
    const repoKey = canonicalRepoUrl(project.repoUrl);
    if (ids.has(project.id)) throw new Error(`${fileName}: id 与 ${ids.get(project.id)} 重复`);
    if (repoUrls.has(repoKey)) throw new Error(`${fileName}: repoUrl 与 ${repoUrls.get(repoKey)} 重复`);
    ids.set(project.id, fileName);
    repoUrls.set(repoKey, fileName);
    projects.push(project);
  }

  const aggregates = aggregateProjects(projects);
  await fs.rm(outputPath, { recursive: true, force: true });
  await writeJson(path.join(outputPath, 'projects.json'), projects.map(({ content, analysis, ...project }) => project));
  await writeJson(path.join(outputPath, 'search-index.json'), buildSearchIndex(projects));
  await writeJson(path.join(outputPath, 'tags.json'), aggregates.tags);
  await writeJson(path.join(outputPath, 'authors.json'), aggregates.authors);
  await writeJson(path.join(outputPath, 'categories.json'), aggregates.categories);
  await writeJson(path.join(outputPath, 'stats.json'), aggregates.stats);

  for (const project of projects) {
    await writeJson(path.join(outputPath, 'projects', `${project.id}.json`), project);
  }

  return { projects, outputDir: outputPath, aggregates };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildIndex()
    .then(({ projects, outputDir }) => {
      console.log(`Built ${projects.length} project(s) from ${reposDir}`);
      console.log(`Output: ${outputDir}`);
      if (offline) console.log('GitHub enrichment: skipped (--offline)');
    })
    .catch((err) => {
      console.error(`[build-index] ${err.message}`);
      process.exitCode = 1;
    });
}
