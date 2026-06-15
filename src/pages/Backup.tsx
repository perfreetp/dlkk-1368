import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import {
  dbAll,
  dbDelete,
  showMessage,
  backupCreate,
  backupRestore,
} from '@/utils/api';
import { formatDate, formatFileSize } from '@/utils';
import './Backup.css';

interface BackupDB {
  id: number;
  backup_name: string;
  file_path: string;
  file_size: number;
  backup_type: string;
  description: string | null;
  created_at: string;
}

interface BackupPreviewData {
  tables: Record<string, number>;
  photoCount: number;
  safeFileCount: number;
  totalSize: number;
  createdAt: string;
  missingFiles?: string[];
  backupVersion: string;
}

const BackupPage: React.FC = () => {
  const { isVisitorMode } = useAppStore();
  const [backups, setBackups] = useState<BackupDB[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<BackupPreviewData | null>(null);
  const [previewBackup, setPreviewBackup] = useState<BackupDB | null>(null);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeSafeFiles, setIncludeSafeFiles] = useState(true);
  const [backupNote, setBackupNote] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadBackups = async () => {
    try {
      const data = await dbAll<BackupDB>(
        'SELECT * FROM backups ORDER BY created_at DESC'
      );
      setBackups(data || []);
    } catch (err) {
      console.error('Load backups error:', err);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    if (isVisitorMode) {
      await showMessage('warning', '访客模式', '访客模式下无法创建备份');
      return;
    }
    setIsCreating(true);
    try {
      const timestamp = formatDate(new Date(), 'YYYYMMDD_HHmmss');
      const backupName = `couple_space_backup_${timestamp}`;

      const result = await backupCreate({
        includePhotos,
        includeSafeFiles,
        backupName,
        description: backupNote || undefined,
      });

      if (result && (result as any).manifest) {
        const manifest = (result as any).manifest;
        const missing = manifest.missingFiles || [];
        if (missing.length > 0) {
          await showMessage(
            'warning',
            '备份完成（有缺失文件）',
            `成功创建备份，但有 ${missing.length} 个文件未找到，已记录在备份元数据中`
          );
        } else {
          await showMessage('success', '备份成功', `备份包已生成，共 ${formatFileSize(result.fileSize || 0)}`);
        }
      } else {
        await showMessage('success', '备份成功', '备份记录已保存');
      }

      setShowCreateModal(false);
      setBackupNote('');
      setIncludePhotos(true);
      setIncludeSafeFiles(true);
      await loadBackups();
    } catch (err: any) {
      console.error('Create backup error:', err);
      await showMessage('error', '备份失败', err?.message || '创建备份时发生未知错误');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePreviewBackup = async (backup: BackupDB) => {
    setPreviewBackup(backup);

    try {
      const counts = {
        时间轴事件: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM timeline_events'))[0]?.count || 0,
        信件: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM letters'))[0]?.count || 0,
        照片: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM photos'))[0]?.count || 0,
        旅行: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM travels'))[0]?.count || 0,
        票据: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM receipts'))[0]?.count || 0,
        目标: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM goals'))[0]?.count || 0,
        任务: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM tasks'))[0]?.count || 0,
        纪念物: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM keepsakes'))[0]?.count || 0,
        温度记录: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM temperature_records'))[0]?.count || 0,
        保险箱文件: (await dbAll<{ count: number }>('SELECT COUNT(*) as count FROM safe_files'))[0]?.count || 0,
      };

      setPreviewData({
        tables: counts,
        photoCount: counts['照片'],
        safeFileCount: counts['保险箱文件'],
        totalSize: backup.file_size,
        createdAt: backup.created_at,
        backupVersion: '1.0.0',
      });
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewData({
        tables: {},
        photoCount: 0,
        safeFileCount: 0,
        totalSize: backup.file_size,
        createdAt: backup.created_at,
        backupVersion: '1.0.0',
      });
    }

    setShowPreview(true);
  };

  const handleRestoreBackup = async (backup: BackupDB) => {
    if (isVisitorMode) {
      await showMessage('warning', '访客模式', '访客模式下无法恢复备份');
      return;
    }
    const confirmed = window.confirm(
      `确定要恢复备份「${backup.backup_name}」吗？\n当前数据会被覆盖，且会自动创建一个恢复前的临时备份以防出错。`
    );
    if (!confirmed) return;

    try {
      const success = await backupRestore(backup.file_path, true);
      if (success) {
        await showMessage(
          'success',
          '恢复成功',
          '备份已恢复完成！为保证数据完整加载，请重启应用。'
        );
      } else {
        await showMessage('error', '恢复失败', '备份恢复未成功');
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      await showMessage(
        'error',
        '恢复失败',
        err?.message || '恢复过程中发生错误，已尝试回滚到恢复前的数据库备份'
      );
    }
  };

  const handleDeleteBackup = async (backup: BackupDB) => {
    const confirmed = window.confirm(
      `确定要删除备份「${backup.backup_name}」吗？\n同时会删除对应的备份文件，此操作不可恢复。`
    );
    if (!confirmed) return;

    try {
      await dbDelete('backups', backup.id);
      try {
        if ((window as any).electronAPI?.backup?.delete) {
          await (window as any).electronAPI.backup.delete(backup.file_path);
        }
      } catch (e) {
        // ignore file delete error
      }
      await showMessage('info', '已删除', '备份记录已删除');
      await loadBackups();
    } catch (err: any) {
      console.error('Delete error:', err);
      await showMessage('error', '删除失败', err?.message || '删除备份失败');
    }
  };

  return (
    <div className="backup-page">
      <div className="backup-actions">
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={isVisitorMode || isCreating}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {isCreating ? '创建中...' : '创建新备份'}
        </button>
        {isVisitorMode && <span className="visitor-warning">访客模式下无法操作</span>}
      </div>

      {backups.length === 0 ? (
        <EmptyState
          icon={<span>💾</span>}
          title="还没有备份"
          description="定期备份可以保护你们的珍贵回忆不丢失，建议立即创建第一个备份"
          action={
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={isVisitorMode}
            >
              创建第一个备份
            </button>
          }
        />
      ) : (
        <div className="backup-list">
          {backups.map((backup) => (
            <div key={backup.id} className="backup-card">
              <div className="backup-card-header">
                <div className="backup-icon">💾</div>
                <div className="backup-info">
                  <h3 className="backup-name">{backup.backup_name}</h3>
                  <div className="backup-meta">
                    <span>{formatDate(backup.created_at, 'YYYY-MM-DD HH:mm:ss')}</span>
                    <span className="backup-size">{formatFileSize(backup.file_size)}</span>
                    <span className={`backup-type ${backup.backup_type}`}>
                      {backup.backup_type === 'full' ? '完整备份' : '部分备份'}
                    </span>
                  </div>
                  {backup.description && (
                    <p className="backup-note">{backup.description}</p>
                  )}
                </div>
              </div>
              <div className="backup-card-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handlePreviewBackup(backup)}
                >
                  预览
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRestoreBackup(backup)}
                  disabled={isVisitorMode}
                >
                  恢复
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteBackup(backup)}
                  disabled={isVisitorMode}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        visible={showCreateModal}
        title="创建备份"
        onClose={() => !isCreating && setShowCreateModal(false)}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={isCreating}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateBackup}
              disabled={isCreating}
            >
              {isCreating ? '打包中，请稍候...' : '确认创建'}
            </button>
          </>
        }
      >
        <div className="create-backup-form">
          <div className="form-group">
            <label className="form-label">备份备注（可选）</label>
            <input
              type="text"
              className="form-input"
              placeholder="例如：周年纪念备份 / 迁移前备份"
              value={backupNote}
              onChange={(e) => setBackupNote(e.target.value)}
              disabled={isCreating}
            />
          </div>
          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
                disabled={isCreating}
              />
              包含照片文件（包体积会显著增加，但能保证恢复后照片完整可用）
            </label>
          </div>
          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={includeSafeFiles}
                onChange={(e) => setIncludeSafeFiles(e.target.checked)}
                disabled={isCreating}
              />
              包含保险箱加密文件
            </label>
          </div>
          <div className="backup-hint">
            💡 备份采用 tar+gzip 打包格式，包含一致的数据库快照、manifest 元数据和可选文件内容。恢复前会自动创建恢复前快照，避免误操作丢失数据。
          </div>
        </div>
      </Modal>

      <Modal
        visible={showPreview}
        title={`备份预览 - ${previewBackup?.backup_name || ''}`}
        onClose={() => setShowPreview(false)}
        width={560}
      >
        {previewData && (
          <div className="backup-preview">
            <div className="preview-section">
              <h4>📊 数据库各表记录数</h4>
              <div className="preview-grid">
                {Object.entries(previewData.tables).map(([name, count]) => (
                  <div key={name} className="preview-item">
                    <span className="preview-label">{name}</span>
                    <span className="preview-value">{count} 条</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="preview-section">
              <h4>📁 文件信息</h4>
              <div className="preview-grid">
                <div className="preview-item">
                  <span className="preview-label">打包大小</span>
                  <span className="preview-value">{formatFileSize(previewData.totalSize)}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">创建时间</span>
                  <span className="preview-value">
                    {formatDate(previewData.createdAt, 'YYYY-MM-DD HH:mm')}
                  </span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">备份版本</span>
                  <span className="preview-value">v{previewData.backupVersion}</span>
                </div>
              </div>
            </div>
            {previewData.missingFiles && previewData.missingFiles.length > 0 && (
              <div className="preview-section">
                <h4 style={{ color: '#f59e0b' }}>⚠️ 缺失文件列表</h4>
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {previewData.missingFiles.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12,
                        color: '#92400e',
                        padding: '4px 0',
                        wordBreak: 'break-all',
                        borderBottom: '1px solid #fef3c7',
                      }}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BackupPage;
