import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildIndex } from '../src/build-index.mjs';

test('buildIndex 把项目 Markdown 构建成前端直接可读的静态 JSON', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cityu-hub-build-'));
  const inputDir = path.join(root, 'repos');
  const outputDir = path.join(root, 'output');
  await fs.mkdir(inputDir);
  await fs.writeFile(
    path.join(inputDir, 'demo.md'),
    [
      '---',
      'id: demo-project',
      'title: Demo Project',
      'author: demo-owner',
      'authorName: Demo Student',
      'major: Computer Science',
      'enrollmentYear: 2024',
      'repoUrl: https://github.com/demo-owner/demo-project',
      'tags: [react, showcase]',
      'category: web',
      'featured: true',
      '---',
      '',
      '# Demo Project',
      '',
      '一个用于展示学生作品的示例项目，支持在线浏览项目介绍和文档内容。',
      '',
      '## Features',
      '',
      '- README 驱动',
    ].join('\n'),
    'utf8',
  );

  try {
    const result = await buildIndex({ inputDir, outputPath: outputDir, useOffline: true });
    assert.equal(result.projects.length, 1);

    const project = result.projects[0];
    assert.equal(project.id, 'demo-project');
    assert.equal(project.name, 'Demo Project');
    assert.equal(project.author, 'demo-owner');
    assert.equal(project.authorName, 'Demo Student');
    assert.equal(project.major, 'Computer Science');
    assert.equal(project.enrollmentYear, 2024);
    assert.equal(project.repo, 'demo-owner/demo-project');
    assert.equal(project.githubUrl, 'https://github.com/demo-owner/demo-project');
    assert.equal(project.demoUrl, null);
    assert.equal(project.language, '');
    assert.equal(project.stars, 0);
    // 离线构建拿不到 GitHub 时间戳，回退到文档自身的修改时间
    assert.match(project.createdAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(project.updatedAt, project.createdAt);
    assert.match(project.description, /示例项目/);
    assert.match(project.readmeHtml, /README 驱动/);
    assert.deepEqual(result.aggregates.tags, [
      { name: 'react', count: 1 },
      { name: 'showcase', count: 1 },
    ]);

    const list = JSON.parse(await fs.readFile(path.join(outputDir, 'projects.json'), 'utf8'));
    assert.equal(list.total, 1);
    assert.equal(list.projects.length, 1);
    assert.deepEqual(list.authors, [{ name: 'demo-owner', count: 1 }]);
    assert.deepEqual(list.categories, [{ name: 'web', count: 1 }]);
    // 列表保持轻量：正文 HTML 与内部字段只出现在详情文件里
    assert.equal(list.projects[0].readmeHtml, undefined);
    assert.equal(list.projects[0].status, undefined);

    const detail = JSON.parse(
      await fs.readFile(path.join(outputDir, 'projects', 'demo-project.json'), 'utf8'),
    );
    assert.match(detail.readmeHtml, /README 驱动/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('buildIndex 在介绍和 Features 为空时回退到 GitHub README 与仓库简介', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cityu-hub-fallback-'));
  const inputDir = path.join(root, 'repos');
  const outputDir = path.join(root, 'output');
  await fs.mkdir(inputDir);
  await fs.writeFile(
    path.join(inputDir, 'empty.md'),
    [
      '---',
      'title: Empty Project',
      'author: demo-owner',
      'authorName: Demo Owner',
      'major: Computer Science',
      'enrollmentYear: 2024',
      'repoUrl: https://github.com/demo-owner/empty-project',
      'category: other',
      'featured: false',
      '---',
      '',
      '## Features',
      '',
    ].join('\n'),
    'utf8',
  );

  try {
    const result = await buildIndex({
      inputDir,
      outputPath: outputDir,
      githubClient: {
        fetchRepoMeta: async () => ({
          repo: 'empty-project',
          owner: 'demo-owner',
          description: '来自 GitHub 的仓库简介。',
          defaultBranch: 'main',
        }),
        fetchReadme: async () => '# Remote Project\n\n来自 GitHub README 的项目介绍。',
      },
    });
    const project = result.projects[0];
    assert.equal(project.name, 'Empty Project');
    assert.match(project.readmeHtml, /来自 GitHub README 的项目介绍/);
    assert.match(project.readmeHtml, /来自 GitHub 的仓库简介/);
    assert.match(project.description, /来自 GitHub README 的项目介绍/);
    assert.equal((project.readmeHtml.match(/<h2>Features<\/h2>/g) ?? []).length, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
