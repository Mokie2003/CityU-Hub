/**
 * 生成文件/URL 安全的 slug：保留中文字符（本地中文项目用），空格与其它符号转 -。
 * 结果为空或过长时用内容哈希兜底，保证唯一且稳定。
 */
import crypto from 'node:crypto';

export function slugify(input, { maxLength = 60, fallbackPrefix = 'project' } = {}) {
  const raw = String(input ?? '').trim();
  const base = raw
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[\s_/\\]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  const trimmed = base.slice(0, maxLength).replace(/[-.]+$/g, '');
  if (trimmed && /[a-z0-9\u4e00-\u9fa5]/.test(trimmed)) return trimmed;

  const hash = crypto.createHash('sha1').update(raw || 'empty').digest('hex').slice(0, 8);
  return `${fallbackPrefix}-${hash}`;
}

export function uniqueId(base, taken) {
  const set = taken instanceof Set ? taken : new Set(taken ?? []);
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}
