import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseFrontmatterDocument } from './lib/frontmatter.js';

const parserRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(parserRoot, '..');
const reposDir = path.resolve(process.env.REPOS_DIR ?? path.join(projectRoot, 'repos'));
const schemaFile = path.join(projectRoot, 'schema', 'repo.schema.json');
const schema = JSON.parse(await fs.readFile(schemaFile, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const files = (await fs.readdir(reposDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_template.md')
  .map((entry) => entry.name)
  .sort();

const ids = new Map();
const repoUrls = new Map();
const failures = [];
for (const file of files) {
  try {
    const { meta } = parseFrontmatterDocument(await fs.readFile(path.join(reposDir, file), 'utf8'), file);
    if (!validateSchema(meta)) {
      const details = (validateSchema.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
      throw new Error(`不符合 repo.schema.json：${details}`);
    }
    const id = meta.id ?? file.replace(/\.md$/i, '');
    const repoUrl = meta.repoUrl.toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '');
    if (ids.has(id)) failures.push(`${file}: id 与 ${ids.get(id)} 重复（${id}）`);
    else ids.set(id, file);
    if (repoUrls.has(repoUrl)) failures.push(`${file}: repoUrl 与 ${repoUrls.get(repoUrl)} 重复（${meta.repoUrl}）`);
    else repoUrls.set(repoUrl, file);
  } catch (err) {
    failures.push(`${file}: ${err.message}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} repository document(s).`);
}
