import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^("|')|("|')$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(overrides = {}) {
  loadEnvFile(path.join(BACKEND_ROOT, '.env'));
  return {
    githubToken: overrides.githubToken ?? process.env.GITHUB_TOKEN ?? '',
    githubTimeoutMs: overrides.githubTimeoutMs ?? toInt(process.env.GITHUB_TIMEOUT_MS, 10000),
    userAgent: 'CityU-Hub-Static-Builder/1.0',
  };
}
