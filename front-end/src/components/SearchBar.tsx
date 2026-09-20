import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { parseQuery, removeQualifier, toQualifierChips } from '../utils/searchParser';

interface SearchBarProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 300;

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const [text, setText] = useState(value);
  const committed = useRef(value);

  // URL / 侧边栏等外部来源改动查询串时，同步回输入框
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  // 输入防抖 300ms
  useEffect(() => {
    if (text === committed.current) return;
    const timer = window.setTimeout(() => {
      committed.current = text;
      onChange(text);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, onChange]);

  const commit = (next: string) => {
    committed.current = next;
    setText(next);
    onChange(next);
  };

  const qualifierChips = toQualifierChips(text);
  const { freeText } = parseQuery(text);

  return (
    <div className="w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand" />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(text);
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              commit('');
            }
          }}
          placeholder={
            placeholder ?? '搜索 xx:xx ｜ 例：author:alice tag:NLP lang:Python category:学习辅助'
          }
          aria-label="搜索项目"
          className="input-brutal h-11 w-full pr-11 pl-9 text-sm"
        />
        {text.length > 0 && (
          <button
            type="button"
            onClick={() => commit('')}
            aria-label="清空搜索"
            className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center border-2 border-line text-muted transition-colors hover:border-brand hover:text-brand"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {(qualifierChips.length > 0 || freeText) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {qualifierChips.map((chip) => (
            <button
              key={`${chip.key}:${chip.value}`}
              type="button"
              onClick={() => commit(removeQualifier(text, chip.key, chip.value))}
              title="移除该条件"
              className="chip-brutal is-active px-2 py-0.5 text-[11px]"
            >
              <span className="font-bold">
                {chip.key}:{chip.value}
              </span>
              <X className="size-3" />
            </button>
          ))}
          {freeText && (
            <span className="mono text-[11px] text-muted">关键词 ▸ {freeText}</span>
          )}
        </div>
      )}
    </div>
  );
}
