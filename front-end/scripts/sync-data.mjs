import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontEndRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(frontEndRoot, '..');
const source = path.join(projectRoot, 'back-end', 'output');
const destination = path.join(frontEndRoot, 'public', 'data');

const projects = JSON.parse(await fs.readFile(path.join(source, 'projects.json'), 'utf8'));
if (Array.isArray(projects) && projects.length === 0) {
	console.warn('No projects were generated; keeping existing front-end data.');
	process.exit(0);
}

await fs.rm(destination, { recursive: true, force: true });
await fs.cp(source, destination, { recursive: true });
console.log(`Synced ${source} -> ${destination}`);
