import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { trackVisit } from './api/stats';
import { PixelPet } from './components/PixelPet';
import { TargetCursor } from './components/TargetCursor';
import { WelcomeDialog } from './components/WelcomeDialog';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

/** 每个会话上报一次站点 UV；接口不可用或开了 Do Not Track 时内部自行跳过 */
function SiteAnalytics() {
  useEffect(() => {
    trackVisit();
  }, []);
  return null;
}

/**
 * 老链接兼容：之前用的是 HashRouter，分享出去的地址形如 `/#/project/xxx`。
 * 换成真实路径后这些链接的 hash 不再被解析，这里补一次跳转，避免老分享失效。
 */
function LegacyHashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#/')) return;
    const path = hash.slice(1).split('?')[0];
    if (!path) return;
    navigate(path, { replace: true });
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    // 用 History 路由：每个项目一个真实 URL（/project/<id>），爬虫才能分别收录；
    // 深链接刷新由 Vercel 的 rewrite 兜底（见 vercel.json）
    <BrowserRouter>
      <ScrollToTop />
      <SiteAnalytics />
      <LegacyHashRedirect />
      {/* 全站目标锁定光标：链接、按钮与卡片都会触发框选 */}
      <TargetCursor targetSelector="a, button, .cursor-target" />
      {/* 像素宠物：在页面里漫步、奔跑，并会和卡片/按钮互动 */}
      <PixelPet />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {/* 首访欢迎弹窗放在路由之外：直接落在详情页（分享链接）时也要能弹出来 */}
      <WelcomeDialog />
    </BrowserRouter>
  );
}
