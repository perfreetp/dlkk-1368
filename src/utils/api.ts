declare global {
  interface Window {
    electronAPI?: {
      encrypt?: (data: string, password: string) => Promise<string>;
      decrypt?: (encrypted: string, password: string) => Promise<string>;
      hashPassword?: (password: string) => Promise<{ hash: string; salt: string }>;
      verifyPassword?: (password: string, hash: string, salt: string) => Promise<boolean>;
      saveFile?: (content: string, filename: string) => Promise<string>;
      readFile?: (filepath: string) => Promise<string>;
      deleteFile?: (filepath: string) => Promise<boolean>;
      selectFile?: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
      selectSaveFile?: (defaultPath?: string) => Promise<string | null>;
      showMessage?: (options: { type: 'info' | 'warning' | 'error' | 'question'; title: string; message: string }) => Promise<void>;
      database?: {
        all?: (sql: string, params?: any[]) => Promise<any[]>;
        get?: (sql: string, params?: any[]) => Promise<any>;
        run?: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
      };
    };
  }
}

export async function encryptData(data: string, password: string): Promise<string> {
  if (window.electronAPI?.encrypt) {
    return window.electronAPI.encrypt(data, password);
  }
  return btoa(encodeURIComponent(data));
}

export async function decryptData(encrypted: string, password: string): Promise<string> {
  if (window.electronAPI?.decrypt) {
    return window.electronAPI.decrypt(encrypted, password);
  }
  try {
    return decodeURIComponent(atob(encrypted));
  } catch {
    throw new Error('解密失败，密码错误或数据损坏');
  }
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  if (window.electronAPI?.hashPassword) {
    return window.electronAPI.hashPassword(password);
  }
  const salt = Math.random().toString(36).substring(2, 18);
  let hash = 0;
  const str = password + salt;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return { hash: hash.toString(36), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  if (window.electronAPI?.verifyPassword) {
    return window.electronAPI.verifyPassword(password, hash, salt);
  }
  let computedHash = 0;
  const str = password + salt;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    computedHash = ((computedHash << 5) - computedHash) + char;
    computedHash = computedHash & computedHash;
  }
  return computedHash.toString(36) === hash;
}

export async function saveFile(content: string, filename: string): Promise<string> {
  if (window.electronAPI?.saveFile) {
    return window.electronAPI.saveFile(content, filename);
  }
  localStorage.setItem(`file_${filename}`, content);
  return filename;
}

export async function readFile(filepath: string): Promise<string> {
  if (window.electronAPI?.readFile) {
    return window.electronAPI.readFile(filepath);
  }
  const content = localStorage.getItem(`file_${filepath}`);
  if (content === null) {
    throw new Error('文件不存在');
  }
  return content;
}

export async function deleteFile(filepath: string): Promise<boolean> {
  if (window.electronAPI?.deleteFile) {
    return window.electronAPI.deleteFile(filepath);
  }
  localStorage.removeItem(`file_${filepath}`);
  return true;
}

export async function selectFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (window.electronAPI?.selectFile) {
    return window.electronAPI.selectFile(filters);
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (filters) {
      input.accept = filters.map(f => f.extensions.map(ext => `.${ext}`).join(',')).join(',');
    }
    input.onchange = () => {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(input.files[0]);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

export async function selectSaveFile(defaultPath?: string): Promise<string | null> {
  if (window.electronAPI?.selectSaveFile) {
    return window.electronAPI.selectSaveFile(defaultPath);
  }
  return defaultPath || `file_${Date.now()}`;
}

export async function dbAll(sql: string, params?: any[]): Promise<any[]> {
  if (window.electronAPI?.database?.all) {
    return window.electronAPI.database.all(sql, params);
  }
  const key = `db_${sql}_${JSON.stringify(params || [])}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

export async function dbGet(sql: string, params?: any[]): Promise<any> {
  if (window.electronAPI?.database?.get) {
    return window.electronAPI.database.get(sql, params);
  }
  const results = await dbAll(sql, params);
  return results[0] || null;
}

export async function dbRun(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }> {
  if (window.electronAPI?.database?.run) {
    return window.electronAPI.database.run(sql, params);
  }
  return { lastID: Date.now(), changes: 1 };
}

export async function dbInsert(table: string, data: Record<string, any>): Promise<number> {
  if (window.electronAPI?.database?.insert) {
    return window.electronAPI.database.insert(table, data);
  }
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const result = await dbRun(sql, values);
  return result.lastID;
}

export async function dbUpdate(table: string, id: number | string, data: Record<string, any>): Promise<boolean> {
  if (window.electronAPI?.database?.update) {
    return window.electronAPI.database.update(table, id, data);
  }
  const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  const sql = `UPDATE ${table} SET ${sets} WHERE id = ?`;
  const result = await dbRun(sql, values);
  return result.changes > 0;
}

export async function dbDelete(table: string, id: number | string): Promise<boolean> {
  if (window.electronAPI?.database?.delete) {
    return window.electronAPI.database.delete(table, id);
  }
  const sql = `DELETE FROM ${table} WHERE id = ?`;
  const result = await dbRun(sql, [id]);
  return result.changes > 0;
}

export async function showMessage(
  typeOrOptions: 'info' | 'warning' | 'error' | 'question' | { type: 'info' | 'warning' | 'error' | 'question'; title: string; message: string },
  titleOrMessage?: string,
  message?: string
): Promise<void> {
  let options: { type: 'info' | 'warning' | 'error' | 'question'; title: string; message: string };

  if (typeof typeOrOptions === 'string') {
    options = {
      type: typeOrOptions,
      title: titleOrMessage || '',
      message: message || titleOrMessage || '',
    };
  } else {
    options = typeOrOptions;
  }

  if (window.electronAPI?.showMessage) {
    return window.electronAPI.showMessage(options);
  }
  const prefix = options.type === 'error' ? '❌ ' : options.type === 'warning' ? '⚠️ ' : options.type === 'question' ? '❓ ' : 'ℹ️ ';
  alert(`${prefix}${options.title}\n\n${options.message}`);
}
