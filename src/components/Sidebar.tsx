import React from 'react';
import { useAppStore } from '@/store';
import type { ViewType } from '@/types';
import './Sidebar.css';

interface NavItem {
  key: ViewType;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    key: 'timeline',
    label: '时间轴',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  {
    key: 'letters',
    label: '信件箱',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
        <path d="M9 10h.01" />
        <path d="M15 10h.01" />
      </svg>
    ),
  },
  {
    key: 'gallery',
    label: '影像库',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
        <circle cx="15.5" cy="14.5" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'travels',
    label: '旅行册',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
        <path d="M12 2v4" />
      </svg>
    ),
  },
  {
    key: 'checklist',
    label: '清单板',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        <line x1="7" y1="9" x2="7.01" y2="9" />
        <line x1="7" y1="13" x2="7.01" y2="13" />
        <line x1="7" y1="17" x2="7.01" y2="17" />
      </svg>
    ),
  },
  {
    key: 'stats',
    label: '统计',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-4 4 4 5-5" />
        <circle cx="7" cy="16" r="1.5" fill="currentColor" />
        <circle cx="11" cy="12" r="1.5" fill="currentColor" />
        <circle cx="15" cy="16" r="1.5" fill="currentColor" />
        <circle cx="20" cy="11" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'safe',
    label: '保险箱',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="2" />
        <path d="M12 18v2" />
      </svg>
    ),
  },
];

const bottomNavItems: NavItem[] = [
  {
    key: 'backup',
    label: '备份管理',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
];

const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, sidebarCollapsed, toggleSidebar, settings, isVisitorMode, setVisitorMode } = useAppStore();

  const handleToggleVisitor = () => {
    setVisitorMode(!isVisitorMode);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = currentView === item.key;
    return (
      <button
        key={item.key}
        className={`sidebar-nav-item ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
        onClick={() => setCurrentView(item.key)}
        title={sidebarCollapsed ? item.label : undefined}
      >
        <span className="sidebar-nav-icon">{item.icon}</span>
        {!sidebarCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
      </button>
    );
  };

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!sidebarCollapsed && (
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">💕</span>
            <span className="sidebar-logo-text">
              {settings.partnerName} & {settings.myName}
            </span>
          </div>
        )}
        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarCollapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      {isVisitorMode && (
        <div className="visitor-mode-badge" onClick={handleToggleVisitor}>
          <span>👁️ 访客模式</span>
        </div>
      )}

      <nav className="sidebar-nav">
        <div className="sidebar-nav-section">
          {!sidebarCollapsed && <div className="sidebar-nav-section-title">我们的空间</div>}
          {navItems.map(renderNavItem)}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-nav-section">
          {!sidebarCollapsed && <div className="sidebar-nav-section-title">系统</div>}
          {bottomNavItems.map(renderNavItem)}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
