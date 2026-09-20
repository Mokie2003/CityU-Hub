import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TargetCursor } from './components/TargetCursor';
import { PixelPet } from './components/PixelPet';
import { HomePage } from './pages/HomePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    // 纯静态部署到 GitHub Pages，使用 HashRouter 保证深链接刷新可用
    <HashRouter>
      <ScrollToTop />
      {/* 全站目标锁定光标：链接、按钮与卡片都会触发框选 */}
      <TargetCursor targetSelector="a, button, .cursor-target" />
      {/* 像素宠物：在页面里漫步、奔跑，并会和卡片/按钮互动 */}
      <PixelPet />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
