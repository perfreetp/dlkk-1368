import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { dbAll, dbRun, showMessage } from '@/utils/api';
import { formatDate, formatDateTime } from '@/utils';
import { useAppStore } from '@/store';
import './Letters.css';

interface LetterDB {
  id: number;
  title: string;
  content: string;
  sender: string;
  recipient: string;
  is_encrypted: number;
  mood: string;
  created_at: string;
  updated_at: string;
}

interface LetterExt {
  id: number;
  title: string;
  content: string;
  sender: 'me' | 'partner';
  recipient: string;
  unlockDate?: string;
  isLocked: boolean;
  isFavorite: boolean;
  isRead: boolean;
  createdAt: string;
}

interface LetterForm {
  id?: number;
  title: string;
  content: string;
  sender: 'me' | 'partner';
  recipient: string;
  unlockDate?: string;
  chatSnippets: string[];
  _isFavorite?: boolean;
  _isRead?: boolean;
}

const defaultForm: LetterForm = {
  title: '',
  content: '',
  sender: 'me',
  recipient: 'TA',
  unlockDate: '',
  chatSnippets: [],
  _isFavorite: false,
  _isRead: false,
};

function parseLetterExt(db: LetterDB): LetterExt {
  let ext = { isFavorite: false, isRead: false, unlockDate: '' };
  try {
    if (db.mood && db.mood.startsWith('{')) {
      ext = { ...ext, ...JSON.parse(db.mood) };
    }
  } catch (e) {
    // ignore
  }
  const isLocked = !!ext.unlockDate && dayjs().isBefore(dayjs(ext.unlockDate));
  return {
    id: db.id,
    title: db.title,
    content: db.content,
    sender: (db.sender as 'me' | 'partner') || 'me',
    recipient: db.recipient,
    unlockDate: ext.unlockDate,
    isLocked,
    isFavorite: ext.isFavorite,
    isRead: ext.isRead,
    createdAt: db.created_at,
  };
}

function serializeLetterExt(data: {
  isFavorite?: boolean;
  isRead?: boolean;
  unlockDate?: string;
}): string {
  return JSON.stringify(data);
}

export default function Letters() {
  const [letters, setLetters] = useState<LetterExt[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [viewingLetter, setViewingLetter] = useState<LetterExt | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [form, setForm] = useState<LetterForm>(defaultForm);
  const [snippetInput, setSnippetInput] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'locked' | 'unlocked' | 'favorite'>('all');
  const { highlightRecord, clearHighlightRecord } = useAppStore();

  const loadLetters = async () => {
    setLoading(true);
    try {
      const sql = 'SELECT * FROM letters ORDER BY created_at DESC';
      const result = (await dbAll(sql)) as LetterDB[];
      setLetters(result.map(parseLetterExt));
    } catch (error) {
      console.error('加载信件失败:', error);
      await showMessage({
        type: 'error',
        title: '加载失败',
        message: '无法加载信件列表，请重试',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLetters();
  }, []);

  useEffect(() => {
    if (highlightRecord.type === 'letters' && highlightRecord.id !== null) {
      const timer = setTimeout(() => {
        const element = document.getElementById('letter-card-' + highlightRecord.id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('record-highlight-pulse');
          setTimeout(() => {
            element.classList.remove('record-highlight-pulse');
          }, 3000);
          const letter = letters.find((l) => l.id === highlightRecord.id);
          if (letter) {
            setTimeout(() => {
              handleView(letter);
            }, 300);
          }
          clearHighlightRecord();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [highlightRecord.timestamp]);

  const handleOpenWriteModal = () => {
    setForm(defaultForm);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm(defaultForm);
    setSnippetInput('');
  };

  const handleEditLetter = (letter: LetterExt) => {
    setViewingLetter(null);
    setForm({
      id: letter.id,
      title: letter.title,
      content: letter.content,
      sender: letter.sender,
      recipient: letter.recipient,
      unlockDate: letter.unlockDate || '',
      chatSnippets: [],
      _isFavorite: letter.isFavorite,
      _isRead: letter.isRead,
    });
    setShowModal(true);
  };

  const handleAddSnippet = () => {
    const text = snippetInput.trim();
    if (text) {
      setForm({ ...form, chatSnippets: [...form.chatSnippets, text] });
      setSnippetInput('');
    }
  };

  const handleRemoveSnippet = (index: number) => {
    const newSnippets = [...form.chatSnippets];
    newSnippets.splice(index, 1);
    setForm({ ...form, chatSnippets: newSnippets });
  };

  const handleMergeSnippets = () => {
    if (form.chatSnippets.length === 0) {
      return;
    }
    const merged = form.chatSnippets
      .map((s, i) => `【摘录${i + 1}】\n${s}`)
      .join('\n\n');
    setForm({ ...form, content: form.content ? `${form.content}\n\n${merged}` : merged });
    setShowMergeModal(false);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '请输入信件标题',
      });
      return;
    }
    if (!form.content.trim()) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '请输入信件内容',
      });
      return;
    }
    if (form.unlockDate && dayjs(form.unlockDate).isBefore(dayjs())) {
      await showMessage({
        type: 'warning',
        title: '提示',
        message: '解封日期必须晚于当前时间',
      });
      return;
    }

    try {
      const moodData = serializeLetterExt({
        isFavorite: form._isFavorite || false,
        isRead: form._isRead || false,
        unlockDate: form.unlockDate || '',
      });

      if (form.id) {
        const sql =
          'UPDATE letters SET title=?, content=?, sender=?, recipient=?, is_encrypted=?, mood=?, updated_at=datetime("now","localtime") WHERE id=?';
        await dbRun(sql, [
          form.title.trim(),
          form.content.trim(),
          form.sender,
          form.recipient,
          form.unlockDate ? 1 : 0,
          moodData,
          form.id,
        ]);

        await showMessage({
          type: 'info',
          title: '成功',
          message: form.unlockDate ? '信件已封存，到期后可查看' : '信件已更新',
        });
      } else {
        const sql =
          'INSERT INTO letters (title, content, sender, recipient, is_encrypted, mood) VALUES (?, ?, ?, ?, ?, ?)';
        await dbRun(sql, [
          form.title.trim(),
          form.content.trim(),
          form.sender,
          form.recipient,
          form.unlockDate ? 1 : 0,
          moodData,
        ]);

        await showMessage({
          type: 'info',
          title: '成功',
          message: form.unlockDate ? '信件已封存，到期后可查看' : '信件已保存',
        });
      }

      handleCloseModal();
      await loadLetters();
    } catch (error) {
      console.error('保存信件失败:', error);
      await showMessage({
        type: 'error',
        title: '保存失败',
        message: '无法保存信件，请重试',
      });
    }
  };

  const handleView = async (letter: LetterExt) => {
    if (letter.isLocked) {
      await showMessage({
        type: 'warning',
        title: '信件已封存',
        message: `这封信将于 ${formatDate(letter.unlockDate!)} 解封，请耐心等待`,
      });
      return;
    }
    setViewingLetter(letter);
    if (!letter.isRead) {
      try {
        const moodData = serializeLetterExt({
          isFavorite: letter.isFavorite,
          isRead: true,
          unlockDate: letter.unlockDate || '',
        });
        const sql = 'UPDATE letters SET mood = ?, updated_at = datetime("now","localtime") WHERE id = ?';
        await dbRun(sql, [moodData, letter.id]);
        setLetters((prev) =>
          prev.map((l) => (l.id === letter.id ? { ...l, isRead: true } : l))
        );
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleToggleFavorite = async (letter: LetterExt, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const moodData = serializeLetterExt({
        isFavorite: !letter.isFavorite,
        isRead: letter.isRead,
        unlockDate: letter.unlockDate || '',
      });
      const sql = 'UPDATE letters SET mood = ?, updated_at = datetime("now","localtime") WHERE id = ?';
      await dbRun(sql, [moodData, letter.id]);
      setLetters((prev) =>
        prev.map((l) => (l.id === letter.id ? { ...l, isFavorite: !l.isFavorite } : l))
      );
    } catch (error) {
      console.error('操作失败:', error);
    }
  };

  const handleDelete = async (letter: LetterExt, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除信件"${letter.title}"吗？`)) {
      return;
    }
    try {
      const sql = 'DELETE FROM letters WHERE id = ?';
      await dbRun(sql, [letter.id]);
      await showMessage({
        type: 'info',
        title: '成功',
        message: '信件已删除',
      });
      await loadLetters();
    } catch (error) {
      console.error('删除信件失败:', error);
      await showMessage({
        type: 'error',
        title: '删除失败',
        message: '无法删除信件，请重试',
      });
    }
  };

  const getRemainingDays = (unlockDate: string) => {
    const diff = dayjs(unlockDate).diff(dayjs(), 'day');
    if (diff > 0) return `${diff}天后解封`;
    const hours = dayjs(unlockDate).diff(dayjs(), 'hour');
    if (hours > 0) return `${hours}小时后解封`;
    return '即将解封';
  };

  const filteredLetters = letters.filter((l) => {
    if (filterType === 'locked') return l.isLocked;
    if (filterType === 'unlocked') return !l.isLocked;
    if (filterType === 'favorite') return l.isFavorite;
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">信件箱</h1>
        <div className="flex gap-md items-center">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="w-auto"
          >
            <option value="all">全部信件</option>
            <option value="unlocked">已解封</option>
            <option value="locked">封存中</option>
            <option value="favorite">收藏</option>
          </select>
          <button className="btn btn-secondary" onClick={() => setShowMergeModal(true)}>
            合并聊天摘录
          </button>
          <button className="btn btn-primary" onClick={handleOpenWriteModal}>
            <span>✉️</span>
            写新信件
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted py-8">加载中...</div>
      ) : letters.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-md">💌</div>
          <p className="text-secondary mb-lg">信箱还是空的，给TA写一封信吧</p>
          <button className="btn btn-primary" onClick={handleOpenWriteModal}>
            写第一封信
          </button>
        </div>
      ) : (
        <div className="letters-grid">
          {filteredLetters.map((letter) => (
            <div
              key={letter.id}
              id={"letter-card-" + letter.id}
              className={`letter-card card ${letter.isLocked ? 'letter-locked' : ''} ${
                !letter.isRead && !letter.isLocked ? 'letter-unread' : ''
              } ${
                String(highlightRecord.id) === String(letter.id) &&
                highlightRecord.type === 'letters'
                  ? 'record-highlight'
                  : ''
              }`}
              onClick={() => handleView(letter)}
            >
              <div className="flex justify-between items-start mb-sm">
                <div className="flex items-center gap-sm">
                  <span className="letter-sender">
                    {letter.sender === 'me' ? '我' : letter.recipient || 'TA'}
                  </span>
                  {!letter.isRead && !letter.isLocked && (
                    <span className="letter-unread-dot" />
                  )}
                </div>
                <div className="flex gap-sm">
                  <button
                    className={`letter-action ${letter.isFavorite ? 'active' : ''}`}
                    onClick={(e) => handleToggleFavorite(letter, e)}
                    title={letter.isFavorite ? '取消收藏' : '收藏'}
                  >
                    {letter.isFavorite ? '❤️' : '🤍'}
                  </button>
                  <button
                    className="letter-action"
                    onClick={(e) => handleDelete(letter, e)}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <h3 className="fw-600 text-lg mb-sm">{letter.title}</h3>
              {letter.isLocked ? (
                <div className="letter-locked-content">
                  <div className="text-3xl mb-sm">🔒</div>
                  <p className="text-secondary">{getRemainingDays(letter.unlockDate!)}</p>
                  <p className="text-muted text-sm mt-xs">
                    解封日期：{formatDate(letter.unlockDate!)}
                  </p>
                </div>
              ) : (
                <p className="letter-preview text-secondary">
                  {letter.content.length > 100
                    ? letter.content.substring(0, 100) + '...'
                    : letter.content}
                </p>
              )}
              <div className="letter-meta text-muted text-sm mt-md">
                {formatDateTime(letter.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content card letter-write-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="fw-600 text-xl mb-lg">{form.id ? '编辑信件' : '写一封信'}</h2>
            <div className="flex-col gap-md">
              <div className="flex gap-md">
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">发件人</label>
                  <select
                    value={form.sender}
                    onChange={(e) => setForm({ ...form, sender: e.target.value as any })}
                  >
                    <option value="me">我</option>
                    <option value="partner">TA</option>
                  </select>
                </div>
                <div className="flex-col gap-sm flex-1">
                  <label className="fw-500">收件人</label>
                  <input
                    type="text"
                    placeholder="TA的称呼"
                    value={form.recipient}
                    onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">标题</label>
                <input
                  type="text"
                  placeholder="请输入信件标题"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">内容</label>
                <textarea
                  rows={8}
                  placeholder="写下你想说的话..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">定时解封（可选）</label>
                <input
                  type="datetime-local"
                  value={form.unlockDate}
                  onChange={(e) => setForm({ ...form, unlockDate: e.target.value })}
                />
                <p className="text-muted text-sm">
                  设置后，信件将在指定日期前无法查看，给未来的TA一个惊喜
                </p>
              </div>
            </div>
            <div className="divider" />
            <div className="flex gap-md justify-end">
              <button className="btn btn-secondary" onClick={handleCloseModal}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {form.id ? '保存修改' : '封存信件'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergeModal && (
        <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2 className="fw-600 text-xl mb-lg">合并聊天摘录</h2>
            <p className="text-secondary mb-md">
              粘贴多段聊天记录，自动整理为一封温馨的信件
            </p>
            <div className="flex-col gap-md">
              <div className="flex-col gap-sm">
                <label className="fw-500">添加摘录</label>
                <div className="flex gap-sm">
                  <textarea
                    rows={3}
                    placeholder="粘贴一段聊天记录或文字..."
                    value={snippetInput}
                    onChange={(e) => setSnippetInput(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <button className="btn btn-secondary mt-sm" onClick={handleAddSnippet}>
                  + 添加此摘录
                </button>
              </div>
              {form.chatSnippets.length > 0 && (
                <div className="flex-col gap-sm">
                  <label className="fw-500">已添加的摘录（{form.chatSnippets.length}）</label>
                  <div className="snippets-list">
                    {form.chatSnippets.map((snippet, i) => (
                      <div key={i} className="snippet-item">
                        <span className="snippet-index">#{i + 1}</span>
                        <p className="snippet-text">{snippet.substring(0, 50)}{snippet.length > 50 ? '...' : ''}</p>
                        <button
                          className="snippet-remove"
                          onClick={() => handleRemoveSnippet(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-col gap-sm">
                <label className="fw-500">信件标题</label>
                <input
                  type="text"
                  placeholder="请输入信件标题"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="flex-col gap-sm">
                <label className="fw-500">附加内容（可选）</label>
                <textarea
                  rows={4}
                  placeholder="可以在这里添加一些引言或总结..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
            </div>
            <div className="divider" />
            <div className="flex gap-md justify-end">
              <button className="btn btn-secondary" onClick={() => setShowMergeModal(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleMergeSnippets();
                  setShowMergeModal(true);
                  setTimeout(() => {
                    setShowModal(true);
                    setShowMergeModal(false);
                  }, 0);
                }}
                disabled={form.chatSnippets.length === 0}
              >
                合并并继续编辑
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingLetter && (
        <div className="modal-overlay" onClick={() => setViewingLetter(null)}>
          <div className="modal-content card letter-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-lg">
              <div>
                <h2 className="fw-600 text-xl">{viewingLetter.title}</h2>
                <p className="text-secondary text-sm mt-xs">
                  来自 {viewingLetter.sender === 'me' ? '我' : viewingLetter.recipient || 'TA'} ·{' '}
                  {formatDateTime(viewingLetter.createdAt)}
                </p>
              </div>
              <div className="flex gap-sm">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleEditLetter(viewingLetter)}
                >
                  ✏️ 编辑
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setViewingLetter(null)}
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="letter-content">
              {viewingLetter.content.split('\n').map((line, i) => (
                <p key={i} className="letter-line">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
