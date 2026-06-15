import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { dbAll, dbRun, showMessage } from '@/utils/api';
import { formatDate, generateId } from '@/utils';
import { useAppStore } from '@/store';
import Modal from '@/components/Modal';
import './Timeline.css';

interface TimelineEventDB {
  id: number;
  title: string;
  description: string;
  event_date: string;
  category: string;
  photo_ids: string;
  created_at: string;
  updated_at: string;
}

interface TimelineEventForm {
  id?: number;
  title: string;
  description: string;
  date: string;
  category: 'milestone' | 'daily' | 'trip' | 'special';
  tags: string[];
}

const categoryLabels: Record<string, string> = {
  milestone: '里程碑',
  daily: '日常',
  trip: '旅行',
  special: '特别',
};

const categoryColors: Record<string, string> = {
  milestone: '#FFB6C1',
  daily: '#A8D8A8',
  trip: '#C9A7EB',
  special: '#FFD9A8',
};

const defaultForm: TimelineEventForm = {
  title: '',
  description: '',
  date: dayjs().format('YYYY-MM-DD'),
  category: 'daily',
  tags: [],
};

export default function Timeline() {
  const [events, setEvents] = useState<TimelineEventDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEventDB | null>(null);
  const [viewingEvent, setViewingEvent] = useState<TimelineEventDB | null>(null);
  const [form, setForm] = useState<TimelineEventForm>(defaultForm);
  const [tagInput, setTagInput] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const { highlightRecord, clearHighlightRecord } = useAppStore();

  const loadEvents = async () => {
    setLoading(true);
    try {
      const sql = 'SELECT * FROM timeline_events ORDER BY event_date DESC, created_at DESC';
      const result = await dbAll(sql);
      setEvents(result as TimelineEventDB[]);
    } catch (error) {
      console.error('加载时间轴事件失败:', error);
      await showMessage({
        type: 'error',
        title: '加载失败',
        message: '无法加载时间轴事件，请重试',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (highlightRecord.type === 'timeline' && highlightRecord.id !== null) {
      const timer = setTimeout(() => {
        const element = document.getElementById('timeline-event-' + highlightRecord.id);
        const foundEvent = events.find((e) => String(e.id) === String(highlightRecord.id));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('record-highlight-pulse');
          setTimeout(() => {
            element.classList.remove('record-highlight-pulse');
          }, 3000);
          clearHighlightRecord();
        }
        if (foundEvent) {
          setTimeout(() => {
            setViewingEvent(foundEvent);
          }, 300);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [highlightRecord.timestamp, events]);

  const handleOpenModal = (event?: TimelineEventDB) => {
    if (event) {
      setEditingEvent(event);
      setForm({
        id: event.id,
        title: event.title,
        description: event.description || '',
        date: event.event_date,
        category: (event.category as any) || 'daily',
        tags: event.photo_ids ? event.photo_ids.split(',').filter(Boolean) : [],
      });
    } else {
      setEditingEvent(null);
      setForm(defaultForm);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEvent(null);
    setForm(defaultForm);
    setTagInput('');
  };

  const handleViewEvent = (event: TimelineEventDB) => {
    setViewingEvent(event);
  };

  const handleCloseViewModal = () => {
    setViewingEvent(null);
  };

  const handleViewToEdit = () => {
    if (viewingEvent) {
      handleOpenModal(viewingEvent);
      handleCloseViewModal();
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '请输入事件标题',
      });
      return;
    }
    if (!form.date) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '请选择事件日期',
      });
      return;
    }

    try {
      const eventData = {
        title: form.title.trim(),
        description: form.description.trim(),
        event_date: form.date,
        category: form.category,
        photo_ids: form.tags.join(','),
      };

      if (editingEvent) {
        const sql =
          'UPDATE timeline_events SET title = ?, description = ?, event_date = ?, category = ?, photo_ids = ?, updated_at = datetime("now","localtime") WHERE id = ?';
        await dbRun(sql, [
          eventData.title,
          eventData.description,
          eventData.event_date,
          eventData.category,
          eventData.photo_ids,
          editingEvent.id,
        ]);
        await showMessage({
          type: 'info',
          title: '成功',
          message: '事件已更新',
        });
      } else {
        const sql =
          'INSERT INTO timeline_events (title, description, event_date, category, photo_ids) VALUES (?, ?, ?, ?, ?)';
        await dbRun(sql, [
          eventData.title,
          eventData.description,
          eventData.event_date,
          eventData.category,
          eventData.photo_ids,
        ]);
        await showMessage({
          type: 'info',
          title: '成功',
          message: '事件已添加',
        });
      }

      handleCloseModal();
      await loadEvents();
    } catch (error) {
      console.error('保存事件失败:', error);
      await showMessage({
        type: 'error',
        title: '保存失败',
        message: '无法保存事件，请重试',
      });
    }
  };

  const handleDelete = async (event: TimelineEventDB) => {
    if (!window.confirm(`确定要删除事件"${event.title}"吗？`)) {
      return;
    }
    try {
      const sql = 'DELETE FROM timeline_events WHERE id = ?';
      await dbRun(sql, [event.id]);
      await showMessage({
        type: 'info',
        title: '成功',
        message: '事件已删除',
      });
      await loadEvents();
    } catch (error) {
      console.error('删除事件失败:', error);
      await showMessage({
        type: 'error',
        title: '删除失败',
        message: '无法删除事件，请重试',
      });
    }
  };

  const filteredEvents =
    filterCategory === 'all'
      ? events
      : events.filter((e) => e.category === filterCategory);

  const groupedEvents = filteredEvents.reduce((groups, event) => {
    const yearMonth = dayjs(event.event_date).format('YYYY年MM月');
    if (!groups[yearMonth]) {
      groups[yearMonth] = [];
    }
    groups[yearMonth].push(event);
    return groups;
  }, {} as Record<string, TimelineEventDB[]>);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">时间轴</h1>
        <div className="flex gap-md items-center">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-auto"
          >
            <option value="all">全部分类</option>
            <option value="milestone">里程碑</option>
            <option value="daily">日常</option>
            <option value="trip">旅行</option>
            <option value="special">特别</option>
          </select>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <span>+</span>
            添加事件
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted py-8">加载中...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-md">📅</div>
          <p className="text-secondary mb-lg">还没有任何事件记录</p>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            添加第一个事件
          </button>
        </div>
      ) : (
        <div className="timeline-container">
          {Object.entries(groupedEvents).map(([yearMonth, monthEvents]) => (
            <div key={yearMonth} className="timeline-group">
              <div className="timeline-group-header">
                <span className="timeline-group-dot" />
                <h2 className="timeline-group-title">{yearMonth}</h2>
              </div>
              <div className="timeline-items">
                {monthEvents.map((event) => (
                  <div
                    key={event.id}
                    id={"timeline-event-" + event.id}
                    className="timeline-item"
                  >
                    <div
                      className="timeline-dot"
                      style={{ backgroundColor: categoryColors[event.category] || '#E8B4D0' }}
                    />
                    <div
                      className={`timeline-card card ${
                        String(highlightRecord.id) === String(event.id) &&
                        highlightRecord.type === 'timeline'
                          ? 'record-highlight'
                          : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-sm">
                        <div
                          className="cursor-pointer flex-1"
                          onClick={() => handleViewEvent(event)}
                        >
                          <h3 className="fw-600 text-lg">{event.title}</h3>
                          <div className="text-secondary text-sm mt-xs">
                            {formatDate(event.event_date)}
                          </div>
                        </div>
                        <div className="flex gap-sm">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewEvent(event)}
                          >
                            👁️ 查看
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenModal(event)}
                          >
                            编辑
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(event)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-secondary mt-sm mb-md">{event.description}</p>
                      )}
                      <div className="flex gap-sm flex-wrap">
                        <span
                          className="badge"
                          style={{
                            backgroundColor: categoryColors[event.category]
                              ? `${categoryColors[event.category]}40`
                              : 'var(--color-primary-light)',
                            color: categoryColors[event.category] || 'var(--color-primary-dark)',
                          }}
                        >
                          {categoryLabels[event.category] || event.category}
                        </span>
                        {event.photo_ids &&
                          event.photo_ids
                            .split(',')
                            .filter(Boolean)
                            .map((tag) => (
                              <span key={tag} className="badge badge-secondary">
                                #{tag}
                              </span>
                            ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!viewingEvent}
        onClose={handleCloseViewModal}
        title={viewingEvent?.title}
        width={600}
        footer={
          <div className="flex gap-md justify-end">
            <button className="btn btn-secondary" onClick={handleCloseViewModal}>
              关闭
            </button>
            <button className="btn btn-primary" onClick={handleViewToEdit}>
              ✏️ 编辑
            </button>
          </div>
        }
      >
        {viewingEvent && (
          <div className="view-event-container">
            <div className="view-event-meta flex gap-sm flex-wrap mb-lg">
              <div className="text-secondary text-sm">
                📅 {formatDate(viewingEvent.event_date)}
              </div>
              <span
                className="badge"
                style={{
                  backgroundColor: categoryColors[viewingEvent.category]
                    ? `${categoryColors[viewingEvent.category]}40`
                    : 'var(--color-primary-light)',
                  color: categoryColors[viewingEvent.category] || 'var(--color-primary-dark)',
                }}
              >
                {categoryLabels[viewingEvent.category] || viewingEvent.category}
              </span>
            </div>

            {viewingEvent.photo_ids &&
              viewingEvent.photo_ids.split(',').filter(Boolean).length > 0 && (
                <div className="view-event-tags mb-lg">
                  {viewingEvent.photo_ids
                    .split(',')
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag} className="view-event-tag">
                        #{tag}
                      </span>
                    ))}
                </div>
              )}

            <div className="view-event-description">
              {viewingEvent.description ? (
                <p className="whitespace-pre-wrap text-secondary leading-relaxed">
                  {viewingEvent.description}
                </p>
              ) : (
                <p className="text-secondary italic">暂无详情描述</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fw-600 text-xl mb-lg">
              {editingEvent ? '编辑事件' : '添加事件'}
            </h2>
            <div className="flex-col gap-md">
              <div className="flex-col gap-sm">
                <label className="fw-500">标题</label>
                <input
                  type="text"
                  placeholder="请输入事件标题"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="flex gap-md">
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">日期</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">分类</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as any })
                    }
                  >
                    <option value="milestone">里程碑</option>
                    <option value="daily">日常</option>
                    <option value="trip">旅行</option>
                    <option value="special">特别</option>
                  </select>
                </div>
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">描述</label>
                <textarea
                  rows={4}
                  placeholder="请输入事件描述"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">标签</label>
                <div className="flex gap-sm">
                  <input
                    type="text"
                    placeholder="输入标签后按回车添加"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <button className="btn btn-secondary" onClick={handleAddTag}>
                    添加
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex gap-sm flex-wrap mt-sm">
                    {form.tags.map((tag) => (
                      <span key={tag} className="badge badge-secondary">
                        #{tag}
                        <button
                          className="tag-remove"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="divider" />
            <div className="flex gap-md justify-end">
              <button className="btn btn-secondary" onClick={handleCloseModal}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editingEvent ? '保存修改' : '添加事件'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
