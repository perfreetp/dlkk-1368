import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { dbAll, dbRun, showMessage, selectFile, deleteFile } from '@/utils/api';
import { formatDate, formatFileSize, debounce } from '@/utils';
import './Gallery.css';

interface PhotoDB {
  id: number;
  title: string;
  description: string;
  file_path: string;
  file_name: string;
  file_hash: string;
  file_size: number;
  album_id: number;
  is_encrypted: number;
  taken_at: string;
  created_at: string;
  updated_at: string;
}

interface PhotoExt {
  id: number;
  title: string;
  description: string;
  filePath: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  tags: string[];
  date: string;
  createdAt: string;
}

interface DuplicateGroup {
  hash: string;
  photos: PhotoExt[];
}

function parsePhotoExt(db: PhotoDB): PhotoExt {
  let tags: string[] = [];
  let description = db.description || '';
  try {
    if (description.startsWith('{')) {
      const parsed = JSON.parse(description);
      tags = parsed.tags || [];
      description = parsed.description || '';
    }
  } catch (e) {
    // ignore
  }
  return {
    id: db.id,
    title: db.title || db.file_name,
    description,
    filePath: db.file_path,
    fileName: db.file_name,
    fileHash: db.file_hash,
    fileSize: db.file_size,
    tags,
    date: db.taken_at || db.created_at,
    createdAt: db.created_at,
  };
}

function serializePhotoExt(description: string, tags: string[]): string {
  if (tags.length === 0) {
    return description;
  }
  return JSON.stringify({ description, tags });
}

export default function Gallery() {
  const [photos, setPhotos] = useState<PhotoExt[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<PhotoExt | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<PhotoExt | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', tags: '' });
  const [scanningDuplicates, setScanningDuplicates] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const sql = 'SELECT * FROM photos ORDER BY taken_at DESC, created_at DESC';
      const result = (await dbAll(sql)) as PhotoDB[];
      setPhotos(result.map(parsePhotoExt));
    } catch (error) {
      console.error('加载照片失败:', error);
      await showMessage({
        type: 'error',
        title: '加载失败',
        message: '无法加载照片列表，请重试',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  const duplicateGroups = useMemo((): DuplicateGroup[] => {
    const hashMap = new Map<string, PhotoExt[]>();
    photos.forEach((photo) => {
      if (!photo.fileHash) return;
      const existing = hashMap.get(photo.fileHash) || [];
      existing.push(photo);
      hashMap.set(photo.fileHash, existing);
    });
    return Array.from(hashMap.entries())
      .filter(([, group]) => group.length > 1)
      .map(([hash, groupPhotos]) => ({ hash, photos: groupPhotos }));
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    let result = photos;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    if (dateRange.start) {
      result = result.filter((p) => dayjs(p.date).isAfter(dayjs(dateRange.start).subtract(1, 'day')));
    }
    if (dateRange.end) {
      result = result.filter((p) => dayjs(p.date).isBefore(dayjs(dateRange.end).add(1, 'day')));
    }

    return result;
  }, [photos, searchQuery, dateRange]);

  const handleImportPhotos = async () => {
    try {
      if (window.electronAPI?.selectFile) {
        const filePath = await selectFile([
          { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        ]);
        if (filePath) {
          const hash = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const fileName = filePath.split(/[\\/]/).pop() || 'photo';
          const sql =
            'INSERT INTO photos (title, description, file_path, file_name, file_hash, file_size, is_encrypted, taken_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
          await dbRun(sql, [
            fileName,
            '',
            filePath,
            fileName,
            hash,
            0,
            0,
            dayjs().format('YYYY-MM-DD HH:mm:ss'),
          ]);
          await showMessage({
            type: 'info',
            title: '导入成功',
            message: '照片已成功导入',
          });
          await loadPhotos();
        }
      } else {
        await showMessage({
          type: 'info',
          title: '提示',
          message: '请在 Electron 环境中使用文件夹导入功能',
        });
      }
    } catch (error) {
      console.error('导入照片失败:', error);
      await showMessage({
        type: 'error',
        title: '导入失败',
        message: '无法导入照片，请重试',
      });
    }
  };

  const handleScanDuplicates = async () => {
    setScanningDuplicates(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setShowDuplicates(true);
      setSelectedForDelete(new Set());
      if (duplicateGroups.length === 0) {
        await showMessage({
          type: 'info',
          title: '扫描完成',
          message: '没有发现重复的照片',
        });
      }
    } finally {
      setScanningDuplicates(false);
    }
  };

  const handleToggleDuplicateSelect = (photoId: number) => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const handleDeleteDuplicates = async () => {
    if (selectedForDelete.size === 0) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '请先选择要删除的重复照片',
      });
      return;
    }
    if (!window.confirm(`确定要删除选中的 ${selectedForDelete.size} 张照片吗？`)) {
      return;
    }
    try {
      const toDelete = photos.filter((p) => selectedForDelete.has(p.id));
      for (const photo of toDelete) {
        const sql = 'DELETE FROM photos WHERE id = ?';
        await dbRun(sql, [photo.id]);
        if (photo.filePath) {
          try {
            await deleteFile(photo.filePath);
          } catch (e) {
            // ignore file delete errors
          }
        }
      }
      await showMessage({
        type: 'info',
        title: '清理完成',
        message: `已删除 ${selectedForDelete.size} 张重复照片`,
      });
      setShowDuplicates(false);
      setSelectedForDelete(new Set());
      await loadPhotos();
    } catch (error) {
      console.error('删除失败:', error);
      await showMessage({
        type: 'error',
        title: '删除失败',
        message: '无法删除照片，请重试',
      });
    }
  };

  const handleViewPhoto = (photo: PhotoExt) => {
    setViewingPhoto(photo);
  };

  const handleOpenEdit = (photo: PhotoExt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPhoto(photo);
    setEditForm({
      title: photo.title,
      description: photo.description,
      tags: photo.tags.join(', '),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPhoto) return;
    try {
      const tags = editForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const description = serializePhotoExt(editForm.description, tags);
      const sql = 'UPDATE photos SET title = ?, description = ?, updated_at = datetime("now","localtime") WHERE id = ?';
      await dbRun(sql, [editForm.title, description, editingPhoto.id]);
      await showMessage({
        type: 'info',
        title: '成功',
        message: '照片信息已更新',
      });
      setEditingPhoto(null);
      await loadPhotos();
    } catch (error) {
      console.error('保存失败:', error);
      await showMessage({
        type: 'error',
        title: '保存失败',
        message: '无法更新照片信息，请重试',
      });
    }
  };

  const handleDeletePhoto = async (photo: PhotoExt, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除这张照片吗？`)) {
      return;
    }
    try {
      const sql = 'DELETE FROM photos WHERE id = ?';
      await dbRun(sql, [photo.id]);
      if (photo.filePath) {
        try {
          await deleteFile(photo.filePath);
        } catch (e) {
          // ignore
        }
      }
      await showMessage({
        type: 'info',
        title: '成功',
        message: '照片已删除',
      });
      await loadPhotos();
    } catch (error) {
      console.error('删除失败:', error);
      await showMessage({
        type: 'error',
        title: '删除失败',
        message: '无法删除照片，请重试',
      });
    }
  };

  const handleSearch = debounce((value: string) => {
    setSearchQuery(value);
  }, 300);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">影像库</h1>
        <div className="flex gap-md items-center flex-wrap">
          <input
            type="text"
            placeholder="搜索标题、描述、标签..."
            className="gallery-search"
            onChange={(e) => handleSearch(e.target.value)}
          />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            title="开始日期"
          />
          <span className="text-muted">至</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            title="结束日期"
          />
          {(dateRange.start || dateRange.end) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setDateRange({ start: '', end: '' })}
            >
              清除日期
            </button>
          )}
          {showDuplicates ? (
            <button className="btn btn-secondary" onClick={() => setShowDuplicates(false)}>
              返回图库
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handleScanDuplicates}
              disabled={scanningDuplicates}
            >
              {scanningDuplicates ? '扫描中...' : '🔍 重复清理'}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleImportPhotos}>
            <span>📷</span>
            导入照片
          </button>
        </div>
      </div>

      {showDuplicates ? (
        <div>
          <div className="flex justify-between items-center mb-lg">
            <h2 className="fw-600 text-lg">
              发现 {duplicateGroups.length} 组重复照片（共
              {duplicateGroups.reduce((sum, g) => sum + g.photos.length, 0)} 张）
            </h2>
            {selectedForDelete.size > 0 && (
              <button className="btn btn-danger" onClick={handleDeleteDuplicates}>
                删除选中（{selectedForDelete.size}张）
              </button>
            )}
          </div>
          {duplicateGroups.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-md">✨</div>
              <p className="text-secondary">没有发现重复的照片，你的相册很整洁！</p>
            </div>
          ) : (
            <div className="duplicate-groups">
              {duplicateGroups.map((group) => (
                <div key={group.hash} className="duplicate-group card mb-lg">
                  <div className="flex items-center gap-sm mb-md">
                    <span className="badge badge-primary">{group.photos.length} 张重复</span>
                    <span className="text-muted text-sm">
                      占用空间约 {formatFileSize(group.photos[0].fileSize * group.photos.length)}
                    </span>
                  </div>
                  <div className="duplicate-photos">
                    {group.photos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className={`duplicate-photo-item ${
                          selectedForDelete.has(photo.id) ? 'selected' : ''
                        }`}
                        onClick={() => {
                          if (index !== 0) {
                            handleToggleDuplicateSelect(photo.id);
                          }
                        }}
                      >
                        {index === 0 && (
                          <div className="duplicate-keep-badge">保留</div>
                        )}
                        <div className="photo-thumbnail">
                          {photo.filePath.startsWith('data:') ||
                          photo.filePath.startsWith('http') ? (
                            <img src={photo.filePath} alt={photo.title} />
                          ) : (
                            <div className="photo-placeholder">
                              <span className="text-4xl">🖼️</span>
                              <span className="text-sm text-muted mt-sm">{photo.fileName}</span>
                            </div>
                          )}
                        </div>
                        <div className="duplicate-photo-info">
                          <p className="text-sm fw-500 truncate">{photo.title}</p>
                          <p className="text-xs text-muted">
                            {formatDate(photo.date)} · {formatFileSize(photo.fileSize)}
                          </p>
                        </div>
                        {index !== 0 && (
                          <div className="duplicate-checkbox">
                            {selectedForDelete.has(photo.id) ? '✓' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="text-center text-muted py-8">加载中...</div>
      ) : photos.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-md">📸</div>
          <p className="text-secondary mb-lg">相册还是空的，导入一些照片吧</p>
          <button className="btn btn-primary" onClick={handleImportPhotos}>
            导入第一张照片
          </button>
        </div>
      ) : (
        <div>
          <p className="text-muted text-sm mb-md">
            共 {filteredPhotos.length} 张照片
            {searchQuery && ` · 搜索"${searchQuery}"`}
            {(dateRange.start || dateRange.end) &&
              ` · ${dateRange.start || '不限'} 至 ${dateRange.end || '不限'}`}
          </p>
          <div className="gallery-grid">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                className="photo-card"
                onClick={() => handleViewPhoto(photo)}
              >
                <div className="photo-thumbnail">
                  {photo.filePath.startsWith('data:') || photo.filePath.startsWith('http') ? (
                    <img src={photo.filePath} alt={photo.title} />
                  ) : (
                    <div className="photo-placeholder">
                      <span className="text-4xl">🖼️</span>
                    </div>
                  )}
                  <div className="photo-actions">
                    <button
                      className="photo-action-btn"
                      onClick={(e) => handleOpenEdit(photo, e)}
                      title="编辑信息"
                    >
                      ✏️
                    </button>
                    <button
                      className="photo-action-btn"
                      onClick={(e) => handleDeletePhoto(photo, e)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="photo-info">
                  <p className="photo-title">{photo.title}</p>
                  <p className="photo-date">{formatDate(photo.date)}</p>
                  {photo.tags.length > 0 && (
                    <div className="photo-tags mt-sm">
                      {photo.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="badge badge-secondary text-xs">
                          #{tag}
                        </span>
                      ))}
                      {photo.tags.length > 3 && (
                        <span className="badge text-xs text-muted">+{photo.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div className="modal-overlay" onClick={() => setViewingPhoto(null)}>
          <div
            className="modal-content card photo-view-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-md">
              <div>
                <h2 className="fw-600 text-lg">{viewingPhoto.title}</h2>
                <p className="text-secondary text-sm">
                  {formatDate(viewingPhoto.date)} · {formatFileSize(viewingPhoto.fileSize)}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewingPhoto(null)}>
                关闭
              </button>
            </div>
            <div className="photo-view-image">
              {viewingPhoto.filePath.startsWith('data:') ||
              viewingPhoto.filePath.startsWith('http') ? (
                <img src={viewingPhoto.filePath} alt={viewingPhoto.title} />
              ) : (
                <div className="photo-placeholder large">
                  <span className="text-6xl">🖼️</span>
                  <p className="text-muted mt-md">{viewingPhoto.fileName}</p>
                  <p className="text-secondary text-sm mt-xs">{viewingPhoto.filePath}</p>
                </div>
              )}
            </div>
            {viewingPhoto.description && (
              <p className="text-secondary mt-md">{viewingPhoto.description}</p>
            )}
            {viewingPhoto.tags.length > 0 && (
              <div className="flex gap-sm flex-wrap mt-md">
                {viewingPhoto.tags.map((tag) => (
                  <span key={tag} className="badge badge-secondary">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editingPhoto && (
        <div className="modal-overlay" onClick={() => setEditingPhoto(null)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fw-600 text-xl mb-lg">编辑照片信息</h2>
            <div className="flex-col gap-md">
              <div className="flex-col gap-sm">
                <label className="fw-500">标题</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">描述</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">标签（用逗号分隔）</label>
                <input
                  type="text"
                  placeholder="例如：旅行, 海边, 纪念日"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                />
              </div>
            </div>
            <div className="divider" />
            <div className="flex gap-md justify-end">
              <button className="btn btn-secondary" onClick={() => setEditingPhoto(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
