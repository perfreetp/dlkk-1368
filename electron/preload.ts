import { contextBridge, ipcRenderer } from 'electron';
import { TableName, QueryOptions, TimelineEvent, Letter, Photo, Travel, Receipt, Goal, Task, Keepsake, TemperatureRecord, SafeFile, Backup, Setting } from './database';
import { EncryptResult, HashResult } from './crypto';
import { ImportPhotoResult, BackupOptions, BackupResult } from './fileManager';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface DatabaseAPI {
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

interface CryptoAPI {
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

interface FileAPI {
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

interface BackupAPI {
  create(options?: BackupOptions): Promise<ApiResponse<BackupResult>>;
  restore(backupPath: string, overwrite?: boolean): Promise<ApiResponse<boolean>>;
  list(): Promise<ApiResponse<Array<{
    name: string;
    path: string;
    size: number;
    created: Date;
  }>>>;
  delete(backupPath: string): Promise<ApiResponse<boolean>>;
  export(backupPath: string, destPath: string): Promise<ApiResponse<boolean>>;
}

interface WindowAPI {
  minimize(): Promise<ApiResponse<null>>;
  maximize(): Promise<ApiResponse<null>>;
  close(): Promise<ApiResponse<null>>;
  isMaximized(): Promise<ApiResponse<boolean>>;
  focus(): Promise<ApiResponse<null>>;
}

interface DialogAPI {
  openFile(options?: Electron.OpenDialogOptions): Promise<ApiResponse<Electron.OpenDialogReturnValue>>;
  saveFile(options?: Electron.SaveDialogOptions): Promise<ApiResponse<Electron.SaveDialogReturnValue>>;
  showMessageBox(options: Electron.MessageBoxOptions): Promise<ApiResponse<Electron.MessageBoxReturnValue>>;
}

declare global {
  interface Window {
    electronAPI: {
      database: DatabaseAPI;
      crypto: CryptoAPI;
      file: FileAPI;
      backup: BackupAPI;
      window: WindowAPI;
      dialog: DialogAPI;
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

const databaseAPI: DatabaseAPI = {
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

const cryptoAPI: CryptoAPI = {
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

const fileAPI: FileAPI = {
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

const backupAPI: BackupAPI = {
  create: (options) => ipcRenderer.invoke('backup:create', options),
  restore: (backupPath, overwrite) => ipcRenderer.invoke('backup:restore', backupPath, overwrite),
  list: () => ipcRenderer.invoke('backup:list'),
  delete: (backupPath) => ipcRenderer.invoke('backup:delete', backupPath),
  export: (backupPath, destPath) => ipcRenderer.invoke('backup:export', backupPath, destPath),
};

const windowAPI: WindowAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  focus: () => ipcRenderer.invoke('window:focus'),
};

const dialogAPI: DialogAPI = {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
};

contextBridge.exposeInMainWorld('electronAPI', {
  database: databaseAPI,
  crypto: cryptoAPI,
  file: fileAPI,
  backup: backupAPI,
  window: windowAPI,
  dialog: dialogAPI,
});
