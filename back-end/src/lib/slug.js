/**
 * 生成文件/URL 安全的 slug。
 * - 英文/数字/连字符/下划线/点 保留并转小写
 * - 中文字符保留（便于本地中文项目），空格与其它符号转 -
 * - 结果为空或过长时，用内容的哈希兜底，保证唯一且稳定
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

/** 在已存在的 id 集合中获取不冲突的 id：foo、foo-2、foo-3 …… */
export function uniqueId(base, taken) {
  const set = taken instanceof Set ? taken : new Set(taken ?? []);
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}
