export interface ParsedQuery {
  qualifiers: {
    author?: string;
    tag?: string;
    lang?: string;
    category?: string;
  };
  freeText: string;
}

/** 只识别这四种限定符，其它形式（如 http://）会被当作自由文本 */
const QUALIFIER_KEYS = ['author', 'tag', 'lang', 'category'] as const;

type QualifierKey = (typeof QUALIFIER_KEYS)[number];

const QUALIFIER_PATTERN = /(\w+):(\S+)/g;

function isQualifierKey(key: string): key is QualifierKey {
  return (QUALIFIER_KEYS as readonly string[]).includes(key);
}

/**
 * 解析 `author:alice tag:NLP 情感分析` 这类查询语法。
 * 限定符值保留原始大小写，比较时统一转小写。
 */
export function parseQuery(input: string): ParsedQuery {
  const qualifiers: ParsedQuery['qualifiers'] = {};
  let freeText = input;

  for (const match of input.matchAll(QUALIFIER_PATTERN)) {
    const [raw, key, value] = match;
    const normalizedKey = key.toLowerCase();
    if (!isQualifierKey(normalizedKey)) continue;
    if (qualifiers[normalizedKey] === undefined) {
      qualifiers[normalizedKey] = decodeValue(value);
    }
    freeText = freeText.replace(raw, ' ');
  }

  return {
    qualifiers,
    freeText: freeText.replace(/\s+/g, ' ').trim(),
  };
}

function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 把一个限定符从查询串中删除，用于「可删除 chip」交互 */
export function removeQualifier(input: string, key: QualifierKey, value?: string): string {
  const next = input.replace(QUALIFIER_PATTERN, (raw, rawKey: string, rawValue: string) => {
    if (rawKey.toLowerCase() !== key) return raw;
    if (value !== undefined && decodeValue(rawValue).toLowerCase() !== value.toLowerCase()) return raw;
    return ' ';
  });
  return next.replace(/\s+/g, ' ').trim();
}

/** 生成用于展示的「可删除 chip」数据 */
export function toQualifierChips(
  input: string,
): Array<{ key: QualifierKey; value: string }> {
  const chips: Array<{ key: QualifierKey; value: string }> = [];
  for (const match of input.matchAll(QUALIFIER_PATTERN)) {
    const key = match[1].toLowerCase();
    if (!isQualifierKey(key)) continue;
    chips.push({ key, value: decodeValue(match[2]) });
  }
  return chips;
}
