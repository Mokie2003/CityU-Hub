import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildIndex } from '../src/build-index.mjs';

test('buildIndex 将项目 Markdown 构建为静态索引与详情 JSON', async () => {
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
    assert.equal(result.projects[0].id, 'demo-project');
    assert.equal(result.projects[0].authorName, 'Demo Student');
    assert.equal(result.projects[0].major, 'Computer Science');
    assert.equal(result.projects[0].enrollmentYear, 2024);
    assert.equal(result.projects[0].summary, '一个用于展示学生作品的示例项目，支持在线浏览项目介绍和文档内容。');
    assert.deepEqual(result.aggregates.tags, [{ name: 'react', count: 1 }, { name: 'showcase', count: 1 }]);

    const list = JSON.parse(await fs.readFile(path.join(outputDir, 'projects.json'), 'utf8'));
    const detail = JSON.parse(await fs.readFile(path.join(outputDir, 'projects', 'demo-project.json'), 'utf8'));
    assert.equal(list[0].content, undefined);
    assert.equal(list[0].forks, 0);
    assert.match(detail.content, /README 驱动/);
    assert.equal(detail.readmeUrl, '/data/projects/demo-project.json');
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
    assert.match(result.projects[0].content, /来自 GitHub README 的项目介绍/);
    assert.match(result.projects[0].content, /来自 GitHub 的仓库简介/);
    assert.equal((result.projects[0].content.match(/^## Features$/gm) ?? []).length, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
