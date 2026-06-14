import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import type { SearchResult, ViewType } from '@/types';
import { dbAll, showMessage } from '@/utils/api';
import './SearchBar.css';

const typeLabels: Record<ViewType, string> = {
  timeline: '时间轴',
  letters: '信件',
  gallery: '照片',
  travels: '旅行',
  checklist: '清单',
  stats: '统计',
  safe: '保险箱',
  backup: '备份',
};

const SearchBar: React.FC = () => {
  const { search, setSearchQuery, setSearchActive, setSearchResults, clearSearch, setCurrentView } = useAppStore();
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchActive(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setSearchActive]);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results: SearchResult[] = [];

    try {
      const likeQuery = `%${query}%`;

      const events = await dbAll<any>(
        'SELECT id, title, description, date FROM timeline_events WHERE title LIKE ? OR description LIKE ? ORDER BY date DESC LIMIT 10',
        [likeQuery, likeQuery]
      );
      events.forEach((e) => results.push({ type: 'timeline', id: e.id, title: e.title, snippet: e.description, date: e.date }));

      const letters = await dbAll<any>(
        'SELECT id, title, content, date FROM letters WHERE title LIKE ? OR content LIKE ? ORDER BY date DESC LIMIT 10',
        [likeQuery, likeQuery]
      );
      letters.forEach((l) => results.push({ type: 'letters', id: l.id, title: l.title, snippet: l.content?.slice(0, 100), date: l.date }));

      const photos = await dbAll<any>(
        'SELECT id, title, description, tags, date FROM photos WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY date DESC LIMIT 10',
        [likeQuery, likeQuery, likeQuery]
      );
      photos.forEach((p) => results.push({ type: 'gallery', id: p.id, title: p.title || '照片', snippet: p.description, date: p.date }));

      const travels = await dbAll<any>(
        'SELECT id, title, description, location, startDate FROM travels WHERE title LIKE ? OR description LIKE ? OR location LIKE ? ORDER BY startDate DESC LIMIT 10',
        [likeQuery, likeQuery, likeQuery]
      );
      travels.forEach((t) => results.push({ type: 'travels', id: t.id, title: t.title, snippet: `${t.location} - ${t.description}`, date: t.startDate }));

      const goals = await dbAll<any>(
        'SELECT id, title, description, deadline FROM goals WHERE title LIKE ? OR description LIKE ? ORDER BY deadline DESC LIMIT 5',
        [likeQuery, likeQuery]
      );
      goals.forEach((g) => results.push({ type: 'checklist', id: g.id, title: `目标: ${g.title}`, snippet: g.description, date: g.deadline }));

      const tasks = await dbAll<any>(
        'SELECT id, title, description, deadline FROM tasks WHERE title LIKE ? OR description LIKE ? ORDER BY deadline DESC LIMIT 5',
        [likeQuery, likeQuery]
      );
      tasks.forEach((t) => results.push({ type: 'checklist', id: t.id, title: `任务: ${t.title}`, snippet: t.description, date: t.deadline }));

      const keepsakes = await dbAll<any>(
        'SELECT id, title, description, date FROM keepsakes WHERE title LIKE ? OR description LIKE ? ORDER BY date DESC LIMIT 5',
        [likeQuery, likeQuery]
      );
      keepsakes.forEach((k) => results.push({ type: 'checklist', id: k.id, title: `纪念物: ${k.title}`, snippet: k.description, date: k.date }));

      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSearchQuery(value);
    setSearchActive(true);
    performSearch(value);
  };

  const handleResultClick = (result: SearchResult) => {
    setCurrentView(result.type);
    clearSearch();
    setInputValue('');
    showMessage('info', `已跳转到 ${typeLabels[result.type]}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      clearSearch();
      setSearchActive(false);
      setInputValue('');
    }
  };

  return (
    <div className="search-bar-container" ref={containerRef}>
      <div className={`search-bar ${search.isActive ? 'active' : ''}`}>
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="搜索回忆..."
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setSearchActive(true)}
          onKeyDown={handleKeyDown}
        />
        {inputValue && (
          <button
            className="search-clear-btn"
            onClick={() => {
              clearSearch();
              setInputValue('');
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {isSearching && <div className="search-loading" />}
      </div>

      {search.isActive && inputValue && (
        <div className="search-dropdown">
          {isSearching ? (
            <div className="search-loading-row">搜索中...</div>
          ) : search.results.length === 0 ? (
            <div className="search-empty">没有找到相关结果</div>
          ) : (
            <div className="search-results-list">
              {search.results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  className="search-result-item"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="search-result-type-badge">{typeLabels[result.type]}</div>
                  <div className="search-result-content">
                    <div className="search-result-title">{result.title}</div>
                    {result.snippet && <div className="search-result-snippet">{result.snippet}</div>}
                  </div>
                  {result.date && <div className="search-result-date">{result.date.slice(0, 10)}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
