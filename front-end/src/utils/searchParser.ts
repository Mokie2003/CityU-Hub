/**
 * 搜索语法（固定格式，与站内提示一致）：
 * - 限定符：`author:alice`、`tag:NLP`、`lang:Rust`、`category:AI/机器学习`
 * - 多个限定符用空格分隔，同时生效：`author:alice lang:Python`
 * - 同一个限定符也可以写多次：`tag:NLP tag:情感分析`
 * - 不带冒号的词走全文模糊匹配：`author:alice 情感`
 * - 只识别上面四种前缀，其它带冒号的写法（例如 http://）按自由文本处理
 */

export const QUALIFIER_KEYS = ['author', 'tag', 'lang', 'category'] as const;

export type QualifierKey = (typeof QUALIFIER_KEYS)[number];

export type Qualifiers = Record<QualifierKey, string[]>;

export interface QualifierChip {
  key: QualifierKey;
  value: string;
}

export interface ParsedQuery {
  qualifiers: Qualifiers;
  /** 去掉限定符后的自由文本，按空白切分成关键词 */
  terms: string[];
  freeText: string;
}

/** 值允许为空，便于用户还在输入 `tag:` 时不至于把结果清空 */
const TOKEN_PATTERN = /(\w+):(\S*)/g;

function isQualifierKey(key: string): key is QualifierKey {
  return (QUALIFIER_KEYS as readonly string[]).includes(key);
}

function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function emptyQualifiers(): Qualifiers {
  return { author: [], tag: [], lang: [], category: [] };
}

/**
 * 解析查询串。限定符的值保留原始大小写，比较时统一转小写；
 * 完全相同的 key:value 只保留一次。
 */
export function parseQuery(input: string): ParsedQuery {
  const qualifiers = emptyQualifiers();

  const rest = input.replace(TOKEN_PATTERN, (raw, rawKey: string, rawValue: string) => {
    const key = rawKey.toLowerCase();
    // 未知前缀（例如 http://example.com）当作自由文本
    if (!isQualifierKey(key)) return raw;
    const value = decodeValue(rawValue).trim();
    if (value && !qualifiers[key].some((item) => item.toLowerCase() === value.toLowerCase())) {
      qualifiers[key].push(value);
    }
    return ' ';
  });

  const freeText = rest.replace(/\s+/g, ' ').trim();

  return {
    qualifiers,
    terms: freeText.toLowerCase().split(/\s+/).filter(Boolean),
    freeText,
  };
}

/** 是否存在任一限定符 */
export function hasQualifiers(qualifiers: Qualifiers): boolean {
  return QUALIFIER_KEYS.some((key) => qualifiers[key].length > 0);
}

/** 把某个限定符（可指定具体值）从查询串里删掉，用于「可删除 chip」交互 */
export function removeQualifier(input: string, key: QualifierKey, value?: string): string {
  const next = input.replace(TOKEN_PATTERN, (raw, rawKey: string, rawValue: string) => {
    if (rawKey.toLowerCase() !== key) return raw;
    if (value !== undefined && decodeValue(rawValue).toLowerCase() !== value.toLowerCase()) return raw;
    return ' ';
  });
  return next.replace(/\s+/g, ' ').trim();
}

/** 生成用于展示的「可删除 chip」数据 */
export function toQualifierChips(input: string): QualifierChip[] {
  const { qualifiers } = parseQuery(input);
  return QUALIFIER_KEYS.flatMap((key) => qualifiers[key].map((value) => ({ key, value })));
}
