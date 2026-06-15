import { create } from 'zustand';
import type { ViewType, SearchState, Settings } from '@/types';

interface AppState {
  currentView: ViewType;
  isVisitorMode: boolean;
  isAuthenticated: boolean;
  sidebarCollapsed: boolean;
  search: SearchState;
  highlightRecord: { type: ViewType | null; id: string | number | null; timestamp: number };
  settings: Settings;
  setCurrentView: (view: ViewType) => void;
  setVisitorMode: (isVisitor: boolean) => void;
  setAuthenticated: (isAuth: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchActive: (active: boolean) => void;
  setSearchResults: (results: SearchState['results']) => void;
  clearSearch: () => void;
  setHighlightRecord: (type: ViewType, id: string | number) => void;
  clearHighlightRecord: () => void;
  updateSettings: (settings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  theme: 'romantic-pink',
  primaryColor: '#E8B4D0',
  secondaryColor: '#C9A7EB',
  accentColor: '#FFB6C1',
  language: 'zh-CN',
  autoBackup: false,
  backupInterval: 'weekly',
  encryptionEnabled: false,
  visitorModeEnabled: false,
  temperatureUnit: 'celsius',
  currency: 'CNY',
  anniversaryDate: '',
  partnerName: 'TA',
  myName: '我',
  notificationsEnabled: true,
};

export const useAppStore = create<AppState>((set) => ({
  currentView: 'timeline' as ViewType,
  isVisitorMode: false,
  isAuthenticated: false,
  sidebarCollapsed: false,
  search: {
    query: '',
    isActive: false,
    results: [],
  },
  highlightRecord: {
    type: null,
    id: null,
    timestamp: 0,
  },
  settings: defaultSettings,

  setCurrentView: (view) => set({ currentView: view }),

  setVisitorMode: (isVisitor) => set({ isVisitorMode: isVisitor }),

  setAuthenticated: (isAuth) => set({ isAuthenticated: isAuth }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setSearchQuery: (query) =>
    set((state) => ({
      search: { ...state.search, query },
    })),

  setSearchActive: (active) =>
    set((state) => ({
      search: { ...state.search, isActive: active },
    })),

  setSearchResults: (results) =>
    set((state) => ({
      search: { ...state.search, results },
    })),

  clearSearch: () =>
    set({
      search: {
        query: '',
        isActive: false,
        results: [],
      },
    }),

  setHighlightRecord: (type, id) =>
    set({
      highlightRecord: { type, id, timestamp: Date.now() },
    }),

  clearHighlightRecord: () =>
    set({
      highlightRecord: { type: null, id: null, timestamp: 0 },
    }),

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
}));
