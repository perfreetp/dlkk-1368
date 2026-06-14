import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import SearchBar from '@/components/SearchBar';
import { useAppStore } from '@/store';
import Timeline from '@/pages/Timeline';
import Letters from '@/pages/Letters';
import Gallery from '@/pages/Gallery';
import Travels from '@/pages/Travel';
import Checklist from '@/pages/Checklist';
import Stats from '@/pages/Stats';
import Safe from '@/pages/Safe';
import Backup from '@/pages/Backup';
import type { ViewType } from '@/types';
import './App.css';

const viewTitles: Record<ViewType, string> = {
  timeline: '时间轴',
  letters: '信件箱',
  gallery: '影像库',
  travels: '旅行册',
  checklist: '清单板',
  stats: '统计',
  safe: '保险箱',
  backup: '备份管理',
};

const viewDescriptions: Record<ViewType, string> = {
  timeline: '记录我们共同走过的每一个重要时刻',
  letters: '珍藏写给彼此的每一封书信',
  gallery: '保存所有美好回忆的影像记录',
  travels: '记录每一次一起走过的旅程',
  checklist: '管理我们的共同目标和任务',
  stats: '看看我们的故事和温度变化',
  safe: '加密保护重要文件和秘密',
  backup: '备份和恢复我们的珍贵回忆',
};

const AppContent: React.FC = () => {
  const { currentView, isVisitorMode } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/${currentView}`);
  }, [currentView, navigate]);

  const renderVisitorMode = () => (
    <div className="visitor-mode-container">
      <div className="visitor-mode-card">
        <div className="visitor-mode-icon">👁️</div>
        <h2>访客模式</h2>
        <p>当前处于访客模式，所有私密内容已隐藏</p>
        <p className="visitor-mode-hint">点击左侧「访客模式」徽章退出</p>
      </div>
    </div>
  );

  const renderPage = (element: React.ReactNode) => {
    if (isVisitorMode && currentView !== 'timeline' && currentView !== 'stats') {
      return renderVisitorMode();
    }
    return element;
  };

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <header className="app-header">
          <div className="app-header-left">
            <h1 className="app-title">{viewTitles[currentView]}</h1>
            <p className="app-subtitle">{viewDescriptions[currentView]}</p>
          </div>
          <div className="app-header-right">
            <SearchBar />
          </div>
        </header>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to={`/${currentView}`} replace />} />
            <Route path="/timeline" element={renderPage(<Timeline />)} />
            <Route path="/letters" element={renderPage(<Letters />)} />
            <Route path="/gallery" element={renderPage(<Gallery />)} />
            <Route path="/travels" element={renderPage(<Travels />)} />
            <Route path="/checklist" element={renderPage(<Checklist />)} />
            <Route path="/stats" element={renderPage(<Stats />)} />
            <Route path="/safe" element={renderPage(<Safe />)} />
            <Route path="/backup" element={renderPage(<Backup />)} />
            <Route path="*" element={<Navigate to={`/${currentView}`} replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
