import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { dbAll, dbRun, showMessage, selectFile } from '@/utils/api';
import { formatDate, formatDateTime, formatFileSize } from '@/utils';
import { useAppStore } from '@/store';
import './Travel.css';

interface TravelDB {
  id: number;
  title: string;
  description: string;
  location: string;
  start_date: string;
  end_date: string;
  photo_ids: string;
  cost: number;
  created_at: string;
  updated_at: string;
}

interface ReceiptDB {
  id: number;
  title: string;
  category: string;
  amount: number;
  currency: string;
  paid_by: string;
  date: string;
  description: string;
  photo_id: number;
  created_at: string;
  updated_at: string;
}

interface RoutePoint {
  id: string;
  location: string;
  date: string;
  description?: string;
}

interface TravelExt {
  id: number;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  cost: number;
  highlights: string[];
  route: RoutePoint[];
  createdAt: string;
}

function parseTravelExt(db: TravelDB): TravelExt {
  let highlights: string[] = [];
  let route: RoutePoint[] = [];
  let description = db.description || '';
  try {
    if (description.startsWith('{')) {
      const parsed = JSON.parse(description);
      highlights = parsed.highlights || [];
      route = parsed.route || [];
      description = parsed.description || '';
    }
  } catch (e) {
    // ignore
  }
  if (route.length === 0 && db.location) {
    route = [{ id: 'default', location: db.location, date: db.start_date }];
  }
  return {
    id: db.id,
    title: db.title,
    description,
    location: db.location || '',
    startDate: db.start_date,
    endDate: db.end_date || db.start_date,
    cost: db.cost || 0,
    highlights,
    route,
    createdAt: db.created_at,
  };
}

function serializeTravelExt(data: {
  description: string;
  highlights: string[];
  route: RoutePoint[];
}): string {
  return JSON.stringify(data);
}

const receiptCategories = [
  { value: 'invoice', label: '发票', icon: '📄' },
  { value: 'ticket', label: '车票', icon: '🎫' },
  { value: 'admission', label: '门票', icon: '🎟️' },
  { value: 'hotel', label: '住宿', icon: '🏨' },
  { value: 'food', label: '餐饮', icon: '🍽️' },
  { value: 'transport', label: '交通', icon: '🚗' },
  { value: 'shopping', label: '购物', icon: '🛍️' },
  { value: 'other', label: '其他', icon: '📦' },
];

function getCategoryInfo(category: string) {
  return receiptCategories.find((c) => c.value === category) || receiptCategories[7];
}

export default function Travel() {
  const [travels, setTravels] = useState<TravelExt[]>([]);
  const [receipts, setReceipts] = useState<ReceiptDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [viewingTravel, setViewingTravel] = useState<TravelExt | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [activeTravelId, setActiveTravelId] = useState<number | null>(null);
  const { highlightRecord, clearHighlightRecord } = useAppStore();

  const [travelForm, setTravelForm] = useState({
    id: 0,
    title: '',
    description: '',
    location: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    cost: 0,
    highlightInput: '',
    highlights: [] as string[],
    route: [] as RoutePoint[],
    routeLocation: '',
    routeDate: dayjs().format('YYYY-MM-DD'),
    routeDescription: '',
  });

  const [receiptForm, setReceiptForm] = useState({
    title: '',
    category: 'other',
    amount: 0,
    date: dayjs().format('YYYY-MM-DD'),
    description: '',
    imagePath: '',
  });

  const loadTravels = async () => {
    setLoading(true);
    try {
      const sql = 'SELECT * FROM travels ORDER BY start_date DESC, created_at DESC';
      const result = (await dbAll(sql)) as TravelDB[];
      setTravels(result.map(parseTravelExt));
    } catch (error) {
      console.error('加载旅行记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReceipts = async (travelId: number) => {
    try {
      const sql = 'SELECT * FROM receipts WHERE photo_id = ? ORDER BY date DESC';
      const result = (await dbAll(sql, [travelId])) as ReceiptDB[];
      setReceipts(result);
    } catch (error) {
      console.error('加载票据失败:', error);
    }
  };

  useEffect(() => {
    loadTravels();
  }, []);

  useEffect(() => {
    if (highlightRecord.type === 'travels' && highlightRecord.id !== null) {
      const timer = setTimeout(() => {
        const element = document.getElementById('travel-card-' + highlightRecord.id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('record-highlight-pulse');
          setTimeout(() => {
            element.classList.remove('record-highlight-pulse');
          }, 3000);
          clearHighlightRecord();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [highlightRecord.timestamp]);

  const getTravelReceipts = (travelId: number) => {
    return receipts.filter((r) => r.photo_id === travelId);
  };

  const handleOpenCreateModal = () => {
    setTravelForm({
      id: 0,
      title: '',
      description: '',
      location: '',
      startDate: dayjs().format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
      cost: 0,
      highlightInput: '',
      highlights: [],
      route: [],
      routeLocation: '',
      routeDate: dayjs().format('YYYY-MM-DD'),
      routeDescription: '',
    });
    setShowModal(true);
  };

  const handleAddHighlight = () => {
    const text = travelForm.highlightInput.trim();
    if (text) {
      setTravelForm({
        ...travelForm,
        highlights: [...travelForm.highlights, text],
        highlightInput: '',
      });
    }
  };

  const handleRemoveHighlight = (index: number) => {
    const newHighlights = [...travelForm.highlights];
    newHighlights.splice(index, 1);
    setTravelForm({ ...travelForm, highlights: newHighlights });
  };

  const handleAddRoutePoint = () => {
    if (!travelForm.routeLocation.trim()) return;
    const newPoint: RoutePoint = {
      id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      location: travelForm.routeLocation.trim(),
      date: travelForm.routeDate,
      description: travelForm.routeDescription.trim() || undefined,
    };
    setTravelForm({
      ...travelForm,
      route: [...travelForm.route, newPoint].sort((a, b) =>
        dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1
      ),
      routeLocation: '',
      routeDescription: '',
    });
  };

  const handleRemoveRoutePoint = (id: string) => {
    setTravelForm({
      ...travelForm,
      route: travelForm.route.filter((p) => p.id !== id),
    });
  };

  const handleSaveTravel = async () => {
    if (!travelForm.title.trim()) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '请输入旅行标题',
      });
      return;
    }
    if (!travelForm.startDate) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '请选择出发日期',
      });
      return;
    }
    try {
      const serializedDesc = serializeTravelExt({
        description: travelForm.description,
        highlights: travelForm.highlights,
        route: travelForm.route,
      });

      const sql =
        'INSERT INTO travels (title, description, location, start_date, end_date, photo_ids, cost) VALUES (?, ?, ?, ?, ?, ?, ?)';
      await dbRun(sql, [
        travelForm.title.trim(),
        serializedDesc,
        travelForm.location || (travelForm.route[0]?.location || ''),
        travelForm.startDate,
        travelForm.endDate || travelForm.startDate,
        '',
        travelForm.cost || 0,
      ]);

      await showMessage({
        type: 'info',
        title: '成功',
        message: '旅行记录已保存',
      });
      setShowModal(false);
      await loadTravels();
    } catch (error) {
      console.error('保存旅行失败:', error);
      await showMessage({
        type: 'error',
        title: '保存失败',
        message: '无法保存旅行记录，请重试',
      });
    }
  };

  const handleViewTravel = async (travel: TravelExt) => {
    setViewingTravel(travel);
    setActiveTravelId(travel.id);
    await loadReceipts(travel.id);
  };

  const handleDeleteTravel = async (travel: TravelExt, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除旅行"${travel.title}"吗？相关票据也会一并删除。`)) {
      return;
    }
    try {
      const sql1 = 'DELETE FROM receipts WHERE photo_id = ?';
      await dbRun(sql1, [travel.id]);
      const sql2 = 'DELETE FROM travels WHERE id = ?';
      await dbRun(sql2, [travel.id]);
      await showMessage({
        type: 'info',
        title: '成功',
        message: '旅行记录已删除',
      });
      await loadTravels();
    } catch (error) {
      console.error('删除失败:', error);
      await showMessage({
        type: 'error',
        title: '删除失败',
        message: '无法删除旅行记录，请重试',
      });
    }
  };

  const handleOpenReceiptModal = () => {
    setReceiptForm({
      title: '',
      category: 'other',
      amount: 0,
      date: dayjs().format('YYYY-MM-DD'),
      description: '',
      imagePath: '',
    });
    setShowReceiptModal(true);
  };

  const handleSaveReceipt = async () => {
    if (!receiptForm.title.trim()) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '请输入票据标题',
      });
      return;
    }
    if (!activeTravelId) return;
    try {
      const sql =
        'INSERT INTO receipts (title, category, amount, currency, paid_by, date, description, photo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      await dbRun(sql, [
        receiptForm.title.trim(),
        receiptForm.category,
        receiptForm.amount || 0,
        'CNY',
        'shared',
        receiptForm.date,
        receiptForm.description,
        activeTravelId,
      ]);
      await showMessage({
        type: 'info',
        title: '成功',
        message: '票据已保存',
      });
      setShowReceiptModal(false);
      await loadReceipts(activeTravelId);
    } catch (error) {
      console.error('保存票据失败:', error);
      await showMessage({
        type: 'error',
        title: '保存失败',
        message: '无法保存票据，请重试',
      });
    }
  };

  const handleDeleteReceipt = async (receipt: ReceiptDB) => {
    if (!window.confirm(`确定要删除票据"${receipt.title}"吗？`)) {
      return;
    }
    try {
      const sql = 'DELETE FROM receipts WHERE id = ?';
      await dbRun(sql, [receipt.id]);
      await loadReceipts(activeTravelId!);
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const getReceiptsByCategory = () => {
    const grouped: Record<string, ReceiptDB[]> = {};
    getTravelReceipts(activeTravelId!).forEach((r) => {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r);
    });
    return grouped;
  };

  const getTotalCost = () => {
    return getTravelReceipts(activeTravelId!).reduce((sum, r) => sum + (r.amount || 0), 0);
  };

  const getDurationDays = (start: string, end: string) => {
    const diff = dayjs(end).diff(dayjs(start), 'day') + 1;
    return diff > 0 ? diff : 1;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">旅行册</h1>
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          <span>✈️</span>
          记录新旅行
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted py-8">加载中...</div>
      ) : travels.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-md">🧳</div>
          <p className="text-secondary mb-lg">还没有旅行记录，开始记录你们的旅程吧</p>
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            记录第一次旅行
          </button>
        </div>
      ) : (
        <div className="travel-grid">
          {travels.map((travel) => (
            <div
              key={travel.id}
              id={"travel-card-" + travel.id}
              className={`travel-card card ${
                String(highlightRecord.id) === String(travel.id) &&
                highlightRecord.type === 'travels'
                  ? 'record-highlight'
                  : ''
              }`}
              onClick={() => handleViewTravel(travel)}
            >
              <div className="travel-card-header">
                <div className="travel-cover">
                  <span className="travel-emoji">🏖️</span>
                </div>
                <button
                  className="travel-delete-btn"
                  onClick={(e) => handleDeleteTravel(travel, e)}
                  title="删除"
                >
                  🗑️
                </button>
              </div>
              <div className="travel-card-body">
                <h3 className="fw-600 text-lg mb-sm">{travel.title}</h3>
                <div className="travel-meta flex-col gap-xs mb-sm">
                  <div className="flex items-center gap-sm text-secondary text-sm">
                    <span>📍</span>
                    <span>
                      {travel.location ||
                        (travel.route.length > 0
                          ? `${travel.route[0].location}${
                              travel.route.length > 1 ? ` 等${travel.route.length}地` : ''
                            }`
                          : '未记录')}
                    </span>
                  </div>
                  <div className="flex items-center gap-sm text-secondary text-sm">
                    <span>📅</span>
                    <span>
                      {formatDate(travel.startDate)}
                      {travel.endDate && travel.endDate !== travel.startDate
                        ? ` ~ ${formatDate(travel.endDate)}`
                        : ''}
                      （{getDurationDays(travel.startDate, travel.endDate)}天）
                    </span>
                  </div>
                  {travel.cost > 0 && (
                    <div className="flex items-center gap-sm text-secondary text-sm">
                      <span>💰</span>
                      <span>¥{travel.cost.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {travel.highlights.length > 0 && (
                  <div className="travel-highlights">
                    {travel.highlights.slice(0, 3).map((h, i) => (
                      <span key={i} className="badge badge-secondary text-xs">
                        ✨ {h}
                      </span>
                    ))}
                  </div>
                )}
                {travel.description && (
                  <p className="travel-desc text-secondary text-sm mt-sm">
                    {travel.description.length > 60
                      ? travel.description.substring(0, 60) + '...'
                      : travel.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-content card travel-form-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="fw-600 text-xl mb-lg">记录新旅行</h2>
            <div className="flex-col gap-md">
              <div className="flex-col gap-sm">
                <label className="fw-500">旅行标题</label>
                <input
                  type="text"
                  placeholder="例如：周末的杭州之旅"
                  value={travelForm.title}
                  onChange={(e) => setTravelForm({ ...travelForm, title: e.target.value })}
                />
              </div>
              <div className="flex gap-md">
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">出发日期</label>
                  <input
                    type="date"
                    value={travelForm.startDate}
                    onChange={(e) =>
                      setTravelForm({ ...travelForm, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">结束日期</label>
                  <input
                    type="date"
                    value={travelForm.endDate}
                    onChange={(e) => setTravelForm({ ...travelForm, endDate: e.target.value })}
                  />
                </div>
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">总花费（元）</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={travelForm.cost || ''}
                    onChange={(e) =>
                      setTravelForm({ ...travelForm, cost: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">描述</label>
                <textarea
                  rows={3}
                  placeholder="记录这次旅行的感受..."
                  value={travelForm.description}
                  onChange={(e) =>
                    setTravelForm({ ...travelForm, description: e.target.value })
                  }
                />
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">路线记录</label>
                <div className="flex gap-sm flex-wrap">
                  <input
                    type="text"
                    placeholder="地点名称"
                    value={travelForm.routeLocation}
                    onChange={(e) =>
                      setTravelForm({ ...travelForm, routeLocation: e.target.value })
                    }
                    className="flex-1 min-w-160"
                  />
                  <input
                    type="date"
                    value={travelForm.routeDate}
                    onChange={(e) =>
                      setTravelForm({ ...travelForm, routeDate: e.target.value })
                    }
                  />
                  <button className="btn btn-secondary" onClick={handleAddRoutePoint}>
                    添加地点
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="该地点的备注（可选）"
                  value={travelForm.routeDescription}
                  onChange={(e) =>
                    setTravelForm({ ...travelForm, routeDescription: e.target.value })
                  }
                />
                {travelForm.route.length > 0 && (
                  <div className="route-list">
                    {travelForm.route.map((point, index) => (
                      <div key={point.id} className="route-item">
                        <div className="route-dot">{index + 1}</div>
                        <div className="route-content">
                          <div className="flex justify-between items-center">
                            <span className="fw-500">{point.location}</span>
                            <button
                              className="text-sm text-muted"
                              onClick={() => handleRemoveRoutePoint(point.id)}
                            >
                              删除
                            </button>
                          </div>
                          <div className="text-sm text-secondary">
                            {formatDate(point.date)}
                            {point.description && ` · ${point.description}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">旅行亮点</label>
                <div className="flex gap-sm">
                  <input
                    type="text"
                    placeholder="添加一个亮点，比如：西湖日落"
                    value={travelForm.highlightInput}
                    onChange={(e) =>
                      setTravelForm({ ...travelForm, highlightInput: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddHighlight();
                      }
                    }}
                  />
                  <button className="btn btn-secondary" onClick={handleAddHighlight}>
                    添加
                  </button>
                </div>
                {travelForm.highlights.length > 0 && (
                  <div className="flex gap-sm flex-wrap mt-sm">
                    {travelForm.highlights.map((h, i) => (
                      <span key={i} className="badge badge-secondary">
                        ✨ {h}
                        <button
                          className="tag-remove"
                          onClick={() => handleRemoveHighlight(i)}
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
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSaveTravel}>
                保存旅行
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingTravel && (
        <div className="modal-overlay" onClick={() => setViewingTravel(null)}>
          <div
            className="modal-content card travel-view-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-lg">
              <div>
                <h2 className="fw-600 text-xl">{viewingTravel.title}</h2>
                <p className="text-secondary text-sm mt-xs">
                  {formatDate(viewingTravel.startDate)} ~{' '}
                  {formatDate(viewingTravel.endDate)}（
                  {getDurationDays(viewingTravel.startDate, viewingTravel.endDate)}天）
                  {viewingTravel.cost > 0 && ` · 总花费 ¥${viewingTravel.cost.toFixed(2)}`}
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setViewingTravel(null)}
              >
                关闭
              </button>
            </div>

            {viewingTravel.description && (
              <p className="text-secondary mb-lg">{viewingTravel.description}</p>
            )}

            {viewingTravel.highlights.length > 0 && (
              <div className="mb-lg">
                <h3 className="fw-600 mb-sm">✨ 旅行亮点</h3>
                <div className="flex gap-sm flex-wrap">
                  {viewingTravel.highlights.map((h, i) => (
                    <span key={i} className="badge badge-secondary">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {viewingTravel.route.length > 0 && (
              <div className="mb-lg">
                <h3 className="fw-600 mb-md">📍 路线时间线</h3>
                <div className="route-timeline">
                  {viewingTravel.route.map((point, index) => (
                    <div key={point.id} className="route-timeline-item">
                      <div className="route-timeline-dot">{index + 1}</div>
                      <div className="route-timeline-content card">
                        <div className="flex justify-between items-center">
                          <span className="fw-600">{point.location}</span>
                          <span className="text-sm text-secondary">
                            {formatDate(point.date)}
                          </span>
                        </div>
                        {point.description && (
                          <p className="text-secondary text-sm mt-sm">{point.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-md">
                <h3 className="fw-600">
                  🎫 票据归类
                  {getTravelReceipts(activeTravelId!).length > 0 && (
                    <span className="text-sm text-secondary ml-sm">
                      共{getTravelReceipts(activeTravelId!).length}张，合计
                      ¥{getTotalCost().toFixed(2)}
                    </span>
                  )}
                </h3>
                <button className="btn btn-primary btn-sm" onClick={handleOpenReceiptModal}>
                  + 添加票据
                </button>
              </div>

              {getTravelReceipts(activeTravelId!).length === 0 ? (
                <div className="text-center py-lg text-muted">
                  暂无票据记录
                </div>
              ) : (
                <div className="receipts-by-category">
                  {Object.entries(getReceiptsByCategory()).map(([category, items]) => {
                    const catInfo = getCategoryInfo(category);
                    const catTotal = items.reduce((sum, r) => sum + (r.amount || 0), 0);
                    return (
                      <div key={category} className="receipt-category mb-md">
                        <div className="flex items-center gap-sm mb-sm">
                          <span className="text-xl">{catInfo.icon}</span>
                          <span className="fw-500">{catInfo.label}</span>
                          <span className="text-sm text-secondary">
                            {items.length}张 · ¥{catTotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="receipt-list flex-col gap-sm">
                          {items.map((r) => (
                            <div key={r.id} className="receipt-item card">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="fw-500">{r.title}</p>
                                  <p className="text-sm text-secondary">
                                    {formatDate(r.date)}
                                    {r.description && ` · ${r.description}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-sm">
                                  <span className="fw-600 text-primary">
                                    ¥{r.amount.toFixed(2)}
                                  </span>
                                  <button
                                    className="text-sm text-muted"
                                    onClick={() => handleDeleteReceipt(r)}
                                  >
                                    删除
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fw-600 text-xl mb-lg">添加票据</h2>
            <div className="flex-col gap-md">
              <div className="flex-col gap-sm">
                <label className="fw-500">票据名称</label>
                <input
                  type="text"
                  placeholder="例如：杭州东-上海虹桥高铁票"
                  value={receiptForm.title}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, title: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-md">
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">分类</label>
                  <select
                    value={receiptForm.category}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, category: e.target.value })
                    }
                  >
                    {receiptCategories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">金额（元）</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={receiptForm.amount || ''}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, amount: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">日期</label>
                  <input
                    type="date"
                    value={receiptForm.date}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">备注</label>
                <input
                  type="text"
                  placeholder="可选"
                  value={receiptForm.description}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, description: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="divider" />
            <div className="flex gap-md justify-end">
              <button className="btn btn-secondary" onClick={() => setShowReceiptModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSaveReceipt}>
                保存票据
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
