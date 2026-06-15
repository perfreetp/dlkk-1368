import { contextBridge, ipcRenderer } from 'electron';
import { TableName, QueryOptions, TimelineEvent, Letter, Photo, Travel, Receipt, Goal, Task, Keepsake, TemperatureRecord, SafeFile, Backup, Setting } from './database';
import { EncryptResult, HashResult } from './crypto';
import {
  ImportPhotoResult,
  BackupOptions,
  BackupResult,
  BackupPreview,
  BackupRecord,
} from './fileManager';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface DatabaseRunResult {
  lastID: number;
  changes: number;
}

interface DatabaseNewAPI {
  all: (sql: string, params?: any[]) => Promise<any[]>;
  get: (sql: string, params?: any[]) => Promise<any>;
  run: (sql: string, params?: any[]) => Promise<DatabaseRunResult>;
  insert: <T extends Record<string, any>>(table: TableName, data: T) => Promise<number>;
  update: <T extends Record<string, any>>(table: TableName, id: number, data: Partial<T>) => Promise<boolean>;
  delete: (table: TableName, id: number) => Promise<boolean>;
}

interface DatabaseLegacyAPI {
  init(): Promise<ApiResponse<null>>;
  insert<T extends Record<string, any>>(table: TableName, data: T): Promise<ApiResponse<number>>;
  update<T extends Record<string, any>>(table: TableName, id: number, data: Partial<T>): Promise<ApiResponse<boolean>>;
  delete(table: TableName, id: number): Promise<ApiResponse<boolean>>;
  deleteWhere(table: TableName, where: Record<string, any>): Promise<ApiResponse<number>>;
  findById<T>(table: TableName, id: number): Promise<ApiResponse<T | null>>;
  findAll<T>(table: TableName, options?: QueryOptions): Promise<ApiResponse<T[]>>;
  findOne<T>(table: TableName, options?: QueryOptions): Promise<ApiResponse<T | null>>;
  count(table: TableName, where?: Record<string, any>): Promise<ApiResponse<number>>;
  customQuery<T>(sql: string, params?: any[]): Promise<ApiResponse<T[]>>;
  customExecute(sql: string, params?: any[]): Promise<ApiResponse<{ changes: number; lastInsertRowid: number }>>;
}

interface DialogNewAPI {
  openFile: (options?: Electron.OpenDialogOptions) => Promise<string[] | null>;
  saveFile: (options?: Electron.SaveDialogOptions) => Promise<string | null>;
  showMessage: (type: 'info' | 'warning' | 'error' | 'question', title: string, message: string) => Promise<void>;
}

interface DialogLegacyAPI {
  openFile(options?: Electron.OpenDialogOptions): Promise<ApiResponse<Electron.OpenDialogReturnValue>>;
  saveFile(options?: Electron.SaveDialogOptions): Promise<ApiResponse<Electron.SaveDialogReturnValue>>;
  showMessageBox(options: Electron.MessageBoxOptions): Promise<ApiResponse<Electron.MessageBoxReturnValue>>;
}

interface CryptoNewAPI {
  encrypt: (data: string, password: string) => Promise<string>;
  decrypt: (encrypted: string, password: string) => Promise<string>;
  hashPassword: (password: string) => Promise<{ hash: string; salt: string }>;
  verifyPassword: (password: string, hash: string, salt: string) => Promise<boolean>;
}

interface CryptoLegacyAPI {
  aesEncrypt(data: string, key?: string): Promise<ApiResponse<EncryptResult>>;
  aesDecrypt(data: string, iv: string, key?: string): Promise<ApiResponse<string>>;
  simpleEncrypt(data: string, key?: string): Promise<ApiResponse<string>>;
  simpleDecrypt(data: string, key?: string): Promise<ApiResponse<string>>;
  md5(data: string): Promise<ApiResponse<string>>;
  sha256(data: string): Promise<ApiResponse<string>>;
  sha512(data: string): Promise<ApiResponse<string>>;
  hashPassword(password: string, salt?: string): Promise<ApiResponse<HashResult>>;
  verifyPassword(password: string, hash: string, salt: string): Promise<ApiResponse<boolean>>;
  randomString(length?: number): Promise<ApiResponse<string>>;
  uuid(): Promise<ApiResponse<string>>;
  setKey(key: string): Promise<ApiResponse<null>>;
}

interface FileNewAPI {
  selectPhotoAndImport: () => Promise<ImportPhotoResult | null>;
  saveFile: (content: string, filename: string) => Promise<string>;
  readFile: (filepath: string) => Promise<string>;
  deleteFile: (filepath: string) => Promise<boolean>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  selectSaveFile: (defaultPath?: string) => Promise<string | null>;
}

interface FileLegacyAPI {
  importPhoto(sourcePath: string, existingHashes: string[]): Promise<ApiResponse<ImportPhotoResult>>;
  importSafeFile(sourcePath: string, encrypt?: boolean): Promise<ApiResponse<ImportPhotoResult>>;
  decryptSafeFile(storedPath: string): Promise<ApiResponse<string>>;
  getMD5(filePath: string): Promise<ApiResponse<string>>;
  getSize(filePath: string): Promise<ApiResponse<number>>;
  exists(filePath: string): Promise<ApiResponse<boolean>>;
  delete(filePath: string): Promise<ApiResponse<boolean>>;
  readAsBase64(filePath: string): Promise<ApiResponse<string | null>>;
  listPhotos(): Promise<ApiResponse<string[]>>;
  getPhotosDir(): Promise<ApiResponse<string>>;
  getSafeFilesDir(): Promise<ApiResponse<string>>;
  getBaseDir(): Promise<ApiResponse<string>>;
  formatSize(bytes: number): Promise<ApiResponse<string>>;
}

interface BackupNewAPI {
  create: (options?: BackupOptions) => Promise<BackupResult>;
  restore: (backupPath: string, overwrite?: boolean) => Promise<boolean>;
  list: () => Promise<BackupRecord[]>;
  delete: (backupPath: string) => Promise<boolean>;
  preview: (backupPath: string) => Promise<BackupPreview>;
}

interface BackupLegacyAPI {
  create(options?: BackupOptions): Promise<ApiResponse<BackupResult>>;
  restore(backupPath: string, overwrite?: boolean): Promise<ApiResponse<boolean>>;
  list(): Promise<ApiResponse<BackupRecord[]>>;
  delete(backupPath: string): Promise<ApiResponse<boolean>>;
  export(backupPath: string, destPath: string): Promise<ApiResponse<boolean>>;
  preview(backupPath: string): Promise<ApiResponse<BackupPreview>>;
}

interface WindowAPI {
  minimize(): Promise<ApiResponse<null>>;
  maximize(): Promise<ApiResponse<null>>;
  close(): Promise<ApiResponse<null>>;
  isMaximized(): Promise<ApiResponse<boolean>>;
  focus(): Promise<ApiResponse<null>>;
}

declare global {
  interface Window {
    electronAPI: {
      database: DatabaseNewAPI & DatabaseLegacyAPI;
      dialog: DialogNewAPI & DialogLegacyAPI;
      crypto: CryptoNewAPI & CryptoLegacyAPI;
      file: FileNewAPI & FileLegacyAPI;
      backup: BackupNewAPI & BackupLegacyAPI;
      window: WindowAPI;
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
      types: {
        TimelineEvent: TimelineEvent;
        Letter: Letter;
        Photo: Photo;
        Travel: Travel;
        Receipt: Receipt;
        Goal: Goal;
        Task: Task;
        Keepsake: Keepsake;
        TemperatureRecord: TemperatureRecord;
        SafeFile: SafeFile;
        Backup: Backup;
        Setting: Setting;
      };
    };
  }
}

async function unwrap<T>(response: ApiResponse<T>): Promise<T> {
  if (response.success) {
    return response.data as T;
  }
  throw new Error(response.error || '未知错误');
}

const databaseLegacyAPI: DatabaseLegacyAPI = {
  init: () => ipcRenderer.invoke('db:init'),
  insert: (table, data) => ipcRenderer.invoke('db:insert', table, data),
  update: (table, id, data) => ipcRenderer.invoke('db:update', table, id, data),
  delete: (table, id) => ipcRenderer.invoke('db:delete', table, id),
  deleteWhere: (table, where) => ipcRenderer.invoke('db:deleteWhere', table, where),
  findById: (table, id) => ipcRenderer.invoke('db:findById', table, id),
  findAll: (table, options) => ipcRenderer.invoke('db:findAll', table, options),
  findOne: (table, options) => ipcRenderer.invoke('db:findOne', table, options),
  count: (table, where) => ipcRenderer.invoke('db:count', table, where),
  customQuery: (sql, params) => ipcRenderer.invoke('db:customQuery', sql, params),
  customExecute: (sql, params) => ipcRenderer.invoke('db:customExecute', sql, params),
};

const databaseNewAPI: DatabaseNewAPI = {
  all: async (sql, params) => {
    try {
      const res = await ipcRenderer.invoke('db:customQuery', sql, params);
      return unwrap<any[]>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  get: async (sql, params) => {
    try {
      const res = await ipcRenderer.invoke('db:customQuery', sql, params);
      const rows = await unwrap<any[]>(res);
      return rows[0] || null;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  run: async (sql, params) => {
    try {
      const res = await ipcRenderer.invoke('db:customExecute', sql, params);
      const result = await unwrap<{ changes: number; lastInsertRowid: number }>(res);
      return {
        lastID: result.lastInsertRowid,
        changes: result.changes,
      };
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  insert: async (table, data) => {
    try {
      const res = await ipcRenderer.invoke('db:insert', table, data);
      return unwrap<number>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  update: async (table, id, data) => {
    try {
      const res = await ipcRenderer.invoke('db:update', table, id, data);
      return unwrap<boolean>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  delete: async (table, id) => {
    try {
      const res = await ipcRenderer.invoke('db:delete', table, id);
      return unwrap<boolean>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
};

const databaseAPI = {
  ...databaseLegacyAPI,
  ...databaseNewAPI,
} as DatabaseNewAPI & DatabaseLegacyAPI;

const cryptoLegacyAPI: CryptoLegacyAPI = {
  aesEncrypt: (data, key) => ipcRenderer.invoke('crypto:aesEncrypt', data, key),
  aesDecrypt: (data, iv, key) => ipcRenderer.invoke('crypto:aesDecrypt', data, iv, key),
  simpleEncrypt: (data, key) => ipcRenderer.invoke('crypto:simpleEncrypt', data, key),
  simpleDecrypt: (data, key) => ipcRenderer.invoke('crypto:simpleDecrypt', data, key),
  md5: (data) => ipcRenderer.invoke('crypto:md5', data),
  sha256: (data) => ipcRenderer.invoke('crypto:sha256', data),
  sha512: (data) => ipcRenderer.invoke('crypto:sha512', data),
  hashPassword: (password, salt) => ipcRenderer.invoke('crypto:hashPassword', password, salt),
  verifyPassword: (password, hash, salt) => ipcRenderer.invoke('crypto:verifyPassword', password, hash, salt),
  randomString: (length) => ipcRenderer.invoke('crypto:randomString', length),
  uuid: () => ipcRenderer.invoke('crypto:uuid'),
  setKey: (key) => ipcRenderer.invoke('crypto:setKey', key),
};

const cryptoNewAPI: CryptoNewAPI = {
  encrypt: async (data, password) => {
    try {
      const res = await ipcRenderer.invoke('crypto:simpleEncrypt', data, password);
      return unwrap<string>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  decrypt: async (encrypted, password) => {
    try {
      const res = await ipcRenderer.invoke('crypto:simpleDecrypt', encrypted, password);
      return unwrap<string>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  hashPassword: async (password) => {
    try {
      const res = await ipcRenderer.invoke('crypto:hashPassword', password);
      const result = await unwrap<HashResult>(res);
      return {
        hash: result.hash,
        salt: result.salt || '',
      };
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  verifyPassword: async (password, hash, salt) => {
    try {
      const res = await ipcRenderer.invoke('crypto:verifyPassword', password, hash, salt);
      return unwrap<boolean>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
};

const cryptoAPI = {
  ...cryptoLegacyAPI,
  ...cryptoNewAPI,
} as CryptoNewAPI & CryptoLegacyAPI;

const fileLegacyAPI: FileLegacyAPI = {
  importPhoto: (sourcePath, existingHashes) => ipcRenderer.invoke('file:importPhoto', sourcePath, existingHashes),
  importSafeFile: (sourcePath, encrypt) => ipcRenderer.invoke('file:importSafeFile', sourcePath, encrypt),
  decryptSafeFile: (storedPath) => ipcRenderer.invoke('file:decryptSafeFile', storedPath),
  getMD5: (filePath) => ipcRenderer.invoke('file:getMD5', filePath),
  getSize: (filePath) => ipcRenderer.invoke('file:getSize', filePath),
  exists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  delete: (filePath) => ipcRenderer.invoke('file:delete', filePath),
  readAsBase64: (filePath) => ipcRenderer.invoke('file:readAsBase64', filePath),
  listPhotos: () => ipcRenderer.invoke('file:listPhotos'),
  getPhotosDir: () => ipcRenderer.invoke('file:getPhotosDir'),
  getSafeFilesDir: () => ipcRenderer.invoke('file:getSafeFilesDir'),
  getBaseDir: () => ipcRenderer.invoke('file:getBaseDir'),
  formatSize: (bytes) => ipcRenderer.invoke('file:formatSize', bytes),
};

const fileNewAPI: FileNewAPI = {
  selectPhotoAndImport: async () => {
    try {
      const dialogRes = await ipcRenderer.invoke('dialog:openFile', {
        filters: [
          { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        ],
        properties: ['openFile'],
      });
      const dialogResult = await unwrap<Electron.OpenDialogReturnValue>(dialogRes);
      if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
        return null;
      }
      const filePath = dialogResult.filePaths[0];
      const importRes = await ipcRenderer.invoke('file:importPhoto', filePath, []);
      return unwrap<ImportPhotoResult>(importRes);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  saveFile: async (content, filename) => {
    try {
      const baseDirRes = await ipcRenderer.invoke('file:getBaseDir');
      const baseDir = await unwrap<string>(baseDirRes);
      const fs = require('fs') as typeof import('fs');
      const path = require('path') as typeof import('path');
      const fullPath = path.join(baseDir, filename);
      fs.writeFileSync(fullPath, content, 'utf-8');
      return fullPath;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  readFile: async (filepath) => {
    try {
      const fs = require('fs') as typeof import('fs');
      return fs.readFileSync(filepath, 'utf-8');
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  deleteFile: async (filepath) => {
    try {
      const res = await ipcRenderer.invoke('file:delete', filepath);
      return unwrap<boolean>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  selectFile: async (filters) => {
    try {
      const dialogRes = await ipcRenderer.invoke('dialog:openFile', {
        filters: filters || [],
        properties: ['openFile'],
      });
      const dialogResult = await unwrap<Electron.OpenDialogReturnValue>(dialogRes);
      if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
        return null;
      }
      return dialogResult.filePaths[0];
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  selectSaveFile: async (defaultPath) => {
    try {
      const options: Electron.SaveDialogOptions = {};
      if (defaultPath) {
        options.defaultPath = defaultPath;
      }
      const dialogRes = await ipcRenderer.invoke('dialog:saveFile', options);
      const dialogResult = await unwrap<Electron.SaveDialogReturnValue>(dialogRes);
      if (dialogResult.canceled || !dialogResult.filePath) {
        return null;
      }
      return dialogResult.filePath;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
};

const fileAPI = {
  ...fileLegacyAPI,
  ...fileNewAPI,
} as FileNewAPI & FileLegacyAPI;

const backupLegacyAPI: BackupLegacyAPI = {
  create: (options) => ipcRenderer.invoke('backup:create', options),
  restore: (backupPath, overwrite) => ipcRenderer.invoke('backup:restore', backupPath, overwrite),
  list: () => ipcRenderer.invoke('backup:list'),
  delete: (backupPath) => ipcRenderer.invoke('backup:delete', backupPath),
  export: (backupPath, destPath) => ipcRenderer.invoke('backup:export', backupPath, destPath),
  preview: (backupPath) => ipcRenderer.invoke('backup:preview', backupPath),
};

const backupNewAPI: BackupNewAPI = {
  create: async (options) => {
    try {
      const res = await ipcRenderer.invoke('backup:create', options);
      return unwrap<BackupResult>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  restore: async (backupPath, overwrite) => {
    try {
      const res = await ipcRenderer.invoke('backup:restore', backupPath, overwrite);
      return unwrap<boolean>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  list: async () => {
    try {
      const res = await ipcRenderer.invoke('backup:list');
      return unwrap<BackupRecord[]>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  delete: async (backupPath) => {
    try {
      const res = await ipcRenderer.invoke('backup:delete', backupPath);
      return unwrap<boolean>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  preview: async (backupPath) => {
    try {
      const res = await ipcRenderer.invoke('backup:preview', backupPath);
      return unwrap<BackupPreview>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
};

const backupAPI = {
  ...backupLegacyAPI,
  ...backupNewAPI,
} as BackupNewAPI & BackupLegacyAPI;

const windowAPI: WindowAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  focus: () => ipcRenderer.invoke('window:focus'),
};

const dialogLegacyAPI: DialogLegacyAPI = {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
};

const dialogNewAPI: DialogNewAPI = {
  openFile: async (options) => {
    try {
      const res = await ipcRenderer.invoke('dialog:openFile', options);
      const result = await unwrap<Electron.OpenDialogReturnValue>(res);
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  saveFile: async (options) => {
    try {
      const res = await ipcRenderer.invoke('dialog:saveFile', options);
      const result = await unwrap<Electron.SaveDialogReturnValue>(res);
      if (result.canceled || !result.filePath) {
        return null;
      }
      return result.filePath;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
  showMessage: async (type, title, message) => {
    try {
      const res = await ipcRenderer.invoke('dialog:showMessage', type, title, message);
      await unwrap<Electron.MessageBoxReturnValue>(res);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },
};

const dialogAPI = {
  ...dialogLegacyAPI,
  ...dialogNewAPI,
} as DialogNewAPI & DialogLegacyAPI;

const exposedAPI = {
  database: databaseAPI,
  crypto: cryptoAPI,
  file: fileAPI,
  backup: backupAPI,
  window: windowAPI,
  dialog: dialogAPI,
  encrypt: cryptoNewAPI.encrypt,
  decrypt: cryptoNewAPI.decrypt,
  hashPassword: cryptoNewAPI.hashPassword,
  verifyPassword: cryptoNewAPI.verifyPassword,
  saveFile: fileNewAPI.saveFile,
  readFile: fileNewAPI.readFile,
  deleteFile: fileNewAPI.deleteFile,
  selectFile: fileNewAPI.selectFile,
  selectSaveFile: fileNewAPI.selectSaveFile,
  showMessage: async (options: { type: 'info' | 'warning' | 'error' | 'question'; title: string; message: string }) => {
    return dialogNewAPI.showMessage(options.type, options.title, options.message);
  },
  types: {
    TimelineEvent: {} as TimelineEvent,
    Letter: {} as Letter,
    Photo: {} as Photo,
    Travel: {} as Travel,
    Receipt: {} as Receipt,
    Goal: {} as Goal,
    Task: {} as Task,
    Keepsake: {} as Keepsake,
    TemperatureRecord: {} as TemperatureRecord,
    SafeFile: {} as SafeFile,
    Backup: {} as Backup,
    Setting: {} as Setting,
  },
};

contextBridge.exposeInMainWorld('electronAPI', exposedAPI);
