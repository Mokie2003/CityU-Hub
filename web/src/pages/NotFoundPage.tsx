import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Header } from '../components/Header';
import { setRouteMeta } from '../utils/seo';

/** 未匹配的路径：给出明确说明，而不是静默跳回首页 */
export function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    setRouteMeta({
      title: '页面不存在 · CityU Hub',
      description: '这个地址没有对应的项目，可能是链接有误或项目已被移除。',
      path: window.location.pathname,
      noindex: true,
    });
  }, []);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <EmptyState
          title="页面不存在"
          description="这个地址没有对应的项目，可能是链接写错了，或者项目已经被移除。"
          actionLabel="回到首页"
          onAction={() => navigate('/')}
        />
      </main>
    </div>
  );
}
