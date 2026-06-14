import { useState, useEffect } from 'react';
import { generateId, formatDate, formatFileSize, formatDateTime, storageGet, storageSet, classNames, readFileAsDataURL } from '@/utils';
import { encryptData, decryptData, hashPassword, verifyPassword } from '@/utils/api';
import './Safe.css';

interface EncryptedFile {
  id: string;
  name: string;
  originalName: string;
  size: number;
  type: string;
  encryptedContent: string;
  createdAt: string;
}

export default function Safe() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(() => storageGet('guestMode', false));
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalType, setPasswordModalType] = useState<'unlock' | 'setPassword' | 'switchMode'>('unlock');
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [decryptingFile, setDecryptingFile] = useState<EncryptedFile | null>(null);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [storedPasswordHash, setStoredPasswordHash] = useState<{ hash: string; salt: string } | null>(
    () => storageGet('safePasswordHash', null)
  );

  const [files, setFiles] = useState<EncryptedFile[]>(() => storageGet('encryptedFiles', []));
  const [encryptPassword, setEncryptPassword] = useState('');
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number; type: string; content: string } | null>(null);

  const [error, setError] = useState('');

  useEffect(() => {
    storageSet('encryptedFiles', files);
  }, [files]);

  useEffect(() => {
    storageSet('guestMode', isGuestMode);
  }, [isGuestMode]);

  useEffect(() => {
    if (storedPasswordHash) {
      storageSet('safePasswordHash', storedPasswordHash);
    }
  }, [storedPasswordHash]);

  const handleUnlock = async () => {
    setError('');
    if (!storedPasswordHash) {
      setPasswordModalType('setPassword');
      setPassword('');
      return;
    }
    const valid = await verifyPassword(password, storedPasswordHash.hash, storedPasswordHash.salt);
    if (valid) {
      setIsUnlocked(true);
      setIsGuestMode(false);
      setShowPasswordModal(false);
      setPassword('');
    } else {
      setError('密码错误，请重试');
    }
  };

  const handleSetPassword = async () => {
    setError('');
    if (password.length < 4) {
      setError('密码至少4位');
      return;
    }
    const result = await hashPassword(password);
    setStoredPasswordHash(result);
    setIsUnlocked(true);
    setIsGuestMode(false);
    setShowPasswordModal(false);
    setPassword('');
  };

  const handleSwitchMode = async () => {
    setError('');
    if (!storedPasswordHash) {
      setIsUnlocked(true);
      setIsGuestMode(false);
      setShowPasswordModal(false);
      return;
    }
    const valid = await verifyPassword(password, storedPasswordHash.hash, storedPasswordHash.salt);
    if (valid) {
      setIsUnlocked(true);
      setIsGuestMode(false);
      setShowPasswordModal(false);
      setPassword('');
    } else {
      setError('密码错误，请重试');
    }
  };

  const enterGuestMode = () => {
    setIsGuestMode(true);
    setIsUnlocked(false);
    setShowPasswordModal(false);
  };

  const lockSafe = () => {
    setIsUnlocked(false);
    setIsGuestMode(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let content = '';
    if (file.type.startsWith('image/') || file.type.includes('pdf') || file.type.includes('text')) {
      content = await readFileAsDataURL(file);
    } else {
      const reader = new FileReader();
      content = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    setPendingFile({
      name: file.name,
      size: file.size,
      type: file.type,
      content,
    });
    setShowEncryptModal(true);
    e.target.value = '';
  };

  const handleEncryptFile = async () => {
    if (!pendingFile) return;
    if (encryptPassword.length < 4) {
      setError('加密密码至少4位');
      return;
    }
    try {
      const encrypted = await encryptData(pendingFile.content, encryptPassword);
      const newFile: EncryptedFile = {
        id: generateId(),
        name: pendingFile.name,
        originalName: pendingFile.name,
        size: pendingFile.size,
        type: pendingFile.type,
        encryptedContent: encrypted,
        createdAt: new Date().toISOString(),
      };
      setFiles([newFile, ...files]);
      setShowEncryptModal(false);
      setPendingFile(null);
      setEncryptPassword('');
      setError('');
    } catch (e) {
      setError('加密失败，请重试');
    }
  };

  const handleDecryptFile = async () => {
    if (!decryptingFile) return;
    try {
      const decrypted = await decryptData(decryptingFile.encryptedContent, decryptPassword);
      setDecryptedContent(decrypted);
      setError('');
    } catch (e) {
      setError('解密失败，密码错误');
    }
  };

  const closeDecryptModal = () => {
    setShowDecryptModal(false);
    setDecryptingFile(null);
    setDecryptPassword('');
    setDecryptedContent(null);
    setError('');
  };

  const deleteFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const downloadDecrypted = () => {
    if (!decryptingFile || !decryptedContent) return;
    const link = document.createElement('a');
    link.href = decryptedContent;
    link.download = decryptingFile.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('video')) return '🎬';
    if (type.includes('audio')) return '🎵';
    if (type.includes('zip') || type.includes('rar') || type.includes('compressed')) return '🗜️';
    return '📁';
  };

  if (!isUnlocked && !isGuestMode && !showPasswordModal) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30">
            <span className="text-6xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">私密保险箱</h1>
          <p className="text-gray-400 mb-10 max-w-sm mx-auto">
            加密存储重要文件，守护我们的专属秘密
          </p>
          <div className="flex flex-col gap-3 w-72 mx-auto">
            <button
              onClick={() => {
                setPasswordModalType(storedPasswordHash ? 'unlock' : 'setPassword');
                setShowPasswordModal(true);
                setPassword('');
                setError('');
              }}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-amber-500/30 transition-all"
            >
              {storedPasswordHash ? '🔓 输入密码解锁' : '🔑 设置密码开启'}
            </button>
            <button
              onClick={enterGuestMode}
              className="px-6 py-3 bg-white/5 text-gray-300 rounded-xl font-medium hover:bg-white/10 border border-white/10 transition-all"
            >
              👤 临时访客模式
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames(
      'h-full flex flex-col',
      isGuestMode
        ? 'bg-gradient-to-br from-gray-100 via-white to-gray-50'
        : 'bg-gradient-to-br from-slate-50 via-white to-amber-50'
    )}>
      <div className={classNames(
        'px-8 py-6 border-b backdrop-blur-sm flex items-center justify-between',
        isGuestMode ? 'bg-gray-100/60 border-gray-200/50' : 'bg-white/60 border-amber-100/50'
      )}>
        <div className="flex items-center gap-4">
          <div className={classNames(
            'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
            isGuestMode
              ? 'bg-gray-200'
              : 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20'
          )}>
            {isGuestMode ? '👤' : '🔐'}
          </div>
          <div>
            <h1 className={classNames(
              'text-2xl font-bold bg-clip-text text-transparent',
              isGuestMode
                ? 'text-gray-700'
                : 'from-amber-500 to-orange-500'
            )}>
              {isGuestMode ? '临时访客模式' : '私密保险箱'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isGuestMode
                ? '当前为访客模式，保险箱内容已隐藏'
                : `加密存储重要文件 · 共 ${files.length} 个文件`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isGuestMode ? (
            <button
              onClick={() => {
                setPasswordModalType('switchMode');
                setShowPasswordModal(true);
                setPassword('');
                setError('');
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-amber-500/25 transition-all flex items-center gap-2"
            >
              <span>🔓</span>
              <span>输入密码解锁</span>
            </button>
          ) : (
            <>
              <label className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-amber-500/25 transition-all flex items-center gap-2 cursor-pointer">
                <span className="text-lg">+</span>
                <span>加密文件</span>
                <input type="file" className="hidden" onChange={handleFileSelect} />
              </label>
              <button
                onClick={lockSafe}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <span>🔒</span>
                <span>锁定</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {isGuestMode ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center mb-6">
              <span className="text-5xl">👤</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">访客模式</h2>
            <p className="text-sm max-w-sm text-center">
              保险箱内容已对访客隐藏，点击右上角「输入密码解锁」查看加密文件
            </p>
          </div>
        ) : files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-28 h-28 rounded-full bg-amber-100 flex items-center justify-center mb-6">
              <span className="text-5xl">🔐</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">保险箱是空的</h2>
            <p className="text-sm">点击右上角「加密文件」添加第一个加密文件</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {files.map(file => (
              <div
                key={file.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-3xl">
                    {getFileIcon(file.type)}
                  </div>
                  <button
                    onClick={() => deleteFile(file.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    🗑️
                  </button>
                </div>
                <h3 className="font-medium text-gray-800 truncate mb-1" title={file.name}>
                  {file.name}
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  {formatFileSize(file.size)} · {formatDate(file.createdAt)}
                </p>
                <button
                  onClick={() => {
                    setDecryptingFile(file);
                    setDecryptPassword('');
                    setDecryptedContent(null);
                    setError('');
                    setShowDecryptModal(true);
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>🔓</span>
                  <span>解密查看</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
                <span className="text-3xl">
                  {passwordModalType === 'setPassword' ? '🔑' : '🔐'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                {passwordModalType === 'unlock' && '解锁保险箱'}
                {passwordModalType === 'setPassword' && '设置保险箱密码'}
                {passwordModalType === 'switchMode' && '输入密码退出访客模式'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {passwordModalType === 'unlock' && '请输入保险箱密码'}
                {passwordModalType === 'setPassword' && '设置一个至少4位的密码'}
                {passwordModalType === 'switchMode' && '请输入密码以查看保险箱内容'}
              </p>
            </div>

            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (
                  passwordModalType === 'unlock' ? handleUnlock() :
                  passwordModalType === 'setPassword' ? handleSetPassword() :
                  handleSwitchMode()
                )}
                placeholder="请输入密码"
                autoFocus
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-center text-lg tracking-wider"
              />
              {error && <p className="text-sm text-red-500 mt-2 text-center">{error}</p>}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setError('');
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={
                  passwordModalType === 'unlock' ? handleUnlock :
                  passwordModalType === 'setPassword' ? handleSetPassword :
                  handleSwitchMode
                }
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                {passwordModalType === 'setPassword' ? '设置密码' : '确认'}
              </button>
            </div>

            {passwordModalType === 'unlock' && (
              <button
                onClick={enterGuestMode}
                className="w-full mt-3 py-2.5 text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                以访客模式进入
              </button>
            )}
          </div>
        </div>
      )}

      {showEncryptModal && pendingFile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-5">加密文件</h2>

            <div className="bg-gray-50 rounded-xl p-4 mb-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-2xl">
                {getFileIcon(pendingFile.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{pendingFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(pendingFile.size)}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">设置加密密码</label>
              <input
                type="password"
                value={encryptPassword}
                onChange={e => setEncryptPassword(e.target.value)}
                placeholder="至少4位，解密时需要此密码"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
              />
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              <p className="text-xs text-gray-400 mt-2">⚠️ 请牢记密码，密码丢失无法恢复文件</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEncryptModal(false);
                  setPendingFile(null);
                  setEncryptPassword('');
                  setError('');
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleEncryptFile}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                🔐 确认加密
              </button>
            </div>
          </div>
        </div>
      )}

      {showDecryptModal && decryptingFile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-800">解密文件</h2>
              <button
                onClick={closeDecryptModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-2xl">
                {getFileIcon(decryptingFile.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{decryptingFile.name}</p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(decryptingFile.size)} · {formatDateTime(decryptingFile.createdAt)}
                </p>
              </div>
            </div>

            {!decryptedContent ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">输入解密密码</label>
                  <input
                    type="password"
                    value={decryptPassword}
                    onChange={e => setDecryptPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleDecryptFile()}
                    placeholder="请输入加密时设置的密码"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
                  />
                  {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={closeDecryptModal}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDecryptFile}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    🔓 解密
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="font-medium text-emerald-800">解密成功</p>
                    <p className="text-sm text-emerald-600">文件已解密，可以预览或下载</p>
                  </div>
                </div>

                {decryptingFile.type.startsWith('image/') && (
                  <div className="mb-5 rounded-xl overflow-hidden border border-gray-200">
                    <img src={decryptedContent} alt={decryptingFile.name} className="w-full max-h-80 object-contain bg-gray-50" />
                  </div>
                )}

                {decryptingFile.type.startsWith('text/') && (
                  <div className="mb-5 rounded-xl border border-gray-200 p-4 max-h-80 overflow-auto bg-gray-50">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {decryptedContent.startsWith('data:')
                        ? '该文件类型需要下载后查看'
                        : decryptedContent}
                    </p>
                  </div>
                )}

                {!decryptingFile.type.startsWith('image/') && !decryptingFile.type.startsWith('text/') && (
                  <div className="mb-5 bg-gray-50 rounded-xl p-8 text-center">
                    <span className="text-5xl block mb-3">{getFileIcon(decryptingFile.type)}</span>
                    <p className="text-gray-600">该文件类型暂不支持预览</p>
                    <p className="text-sm text-gray-400 mt-1">请下载后使用相应软件打开</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeDecryptModal}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    关闭
                  </button>
                  <button
                    onClick={downloadDecrypted}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>⬇️</span>
                    <span>下载原文件</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
