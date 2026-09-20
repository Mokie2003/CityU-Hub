import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

type UrlStatePatch = Record<string, string | undefined>;

/**
 * 把状态同步到 URL query param（刷新可恢复、链接可分享）。
 * 空值会自动从 URL 中移除该参数。
 *
 * 返回 [值, 设置单个值, 批量设置多个值]。
 * 同一事件里需要改多个参数时必须用第三个批量方法：router 的 setSearchParams
 * 在一次 tick 内多次调用只会以最后一次为准。
 */
export function useUrlState(
  key: string,
  defaultValue = '',
): [string, (next: string) => void, (patch: UrlStatePatch) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? defaultValue;

  const patchParams = useCallback(
    (patch: UrlStatePatch) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          for (const [paramKey, paramValue] of Object.entries(patch)) {
            if (!paramValue) params.delete(paramKey);
            else params.set(paramKey, paramValue);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setValue = useCallback(
    (next: string) => patchParams({ [key]: next || undefined }),
    [patchParams, key],
  );

  return [value, setValue, patchParams];
}
