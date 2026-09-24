/**
 * 网页表单的提交。
 *
 * 服务端拿站点自己的 token 直接往 feature 分支开 PR，提交者不用先 fork 仓库。
 * 接口没配好或压根不存在（本地开发没有 serverless 函数）时返回 fallback，
 * 由调用方退回原来的 GitHub 流程。
 */

export interface SubmitPayload {
  fileName: string;
  content: string;
}

export type SubmitResult =
  | { status: 'created'; url: string; number: number }
  | { status: 'fallback' }
  | { status: 'error'; message: string };

interface SubmitResponse {
  ok?: boolean;
  error?: string;
  url?: string;
  number?: number;
  message?: string;
}

export async function submitProject(payload: SubmitPayload): Promise<SubmitResult> {
  let data: SubmitResponse;
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = (await res.json()) as SubmitResponse;
  } catch {
    // 网络断了、或本地开发时 Vite 把未知路径回落到 index.html，都按接口不可用处理
    return { status: 'fallback' };
  }

  if (data?.ok && data.url) return { status: 'created', url: data.url, number: data.number ?? 0 };
  if (data?.error === 'submit-disabled') return { status: 'fallback' };
  return { status: 'error', message: data?.message ?? '提交失败，请稍后重试' };
}