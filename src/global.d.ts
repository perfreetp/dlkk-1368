export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type TableName =
  | 'timeline_events'
  | 'letters'
  | 'photos'
  | 'travels'
  | 'receipts'
  | 'goals'
  | 'tasks'
  | 'keepsakes'
  | 'temperature_records'
  | 'safe_files'
  | 'backups'
  | 'settings';

export interface QueryOptions {
  where?: Record<string, any>;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface ImportPhotoResult {
  success: boolean;
  file_path?: string;
  file_name?: string;
  file_hash?: string;
  file_size?: number;
  isDuplicate?: boolean;
  error?: string;
}

export interface BackupOptions {
  includePhotos?: boolean;
  includeSafeFiles?: boolean;
  backupName?: string;
}

export interface BackupManifest {
  backupTime: string;
  version: string;
  includePhotos: boolean;
  includeSafeFiles: boolean;
  dbFileName: string;
  tableStats: Record<string, number>;
  missingFiles?: string[];
  photoCount?: number;
  safeFileCount?: number;
}

export interface PhotoManifestEntry {
  id: number;
  originalPath: string;
  storedPath: string;
  fileHash: string;
  fileSize: number;
}

export interface PhotoManifest {
  entries: PhotoManifestEntry[];
}

export interface SafeFileManifestEntry {
  id: number;
  originalStoredPath: string;
  storedPath: string;
  fileHash: string;
  fileSize: number;
  originalName: string;
}

export interface SafeFileManifest {
  entries: SafeFileManifestEntry[];
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  manifest?: BackupManifest;
  photoCount?: number;
  safeFileCount?: number;
  error?: string;
}

export interface BackupRecord {
  id?: number;
  backup_name: string;
  file_path: string;
  file_size: number;
  backup_type: string;
  description?: string;
  created_at?: string;
  fileExists: boolean;
}

export interface BackupPreview {
  manifest: BackupManifest;
  photoManifest?: PhotoManifest;
  safeFileManifest?: SafeFileManifest;
}

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  created: Date;
}

export interface EncryptResult {
  encrypted: string;
  iv: string;
}

export interface HashResult {
  hash: string;
  salt: string;
}

interface DatabaseAPI {
  init?: () => Promise<ApiResponse<null>>;
  insert?: <T extends Record<string, any>>(table: TableName, data: T) => Promise<ApiResponse<number>>;
  update?: <T extends Record<string, any>>(table: TableName, id: number, data: Partial<T>) => Promise<ApiResponse<boolean>>;
  delete?: (table: TableName, id: number) => Promise<ApiResponse<boolean>>;
  deleteWhere?: (table: TableName, where: Record<string, any>) => Promise<ApiResponse<number>>;
  findById?: <T>(table: TableName, id: number) => Promise<ApiResponse<T | null>>;
  findAll?: <T>(table: TableName, options?: QueryOptions) => Promise<ApiResponse<T[]>>;
  findOne?: <T>(table: TableName, options?: QueryOptions) => Promise<ApiResponse<T | null>>;
  count?: (table: TableName, where?: Record<string, any>) => Promise<ApiResponse<number>>;
  customQuery?: <T>(sql: string, params?: any[]) => Promise<ApiResponse<T[]>>;
  customExecute?: (sql: string, params?: any[]) => Promise<ApiResponse<{ changes: number; lastInsertRowid: number }>>;
  all?: (sql: string, params?: any[]) => Promise<any[]>;
  get?: (sql: string, params?: any[]) => Promise<any>;
  run?: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
}

interface CryptoAPI {
  aesEncrypt?: (data: string, key?: string) => Promise<ApiResponse<EncryptResult>>;
  aesDecrypt?: (data: string, iv: string, key?: string) => Promise<ApiResponse<string>>;
  simpleEncrypt?: (data: string, key?: string) => Promise<ApiResponse<string>>;
  simpleDecrypt?: (data: string, key?: string) => Promise<ApiResponse<string>>;
  md5?: (data: string) => Promise<ApiResponse<string>>;
  sha256?: (data: string) => Promise<ApiResponse<string>>;
  sha512?: (data: string) => Promise<ApiResponse<string>>;
  hashPassword?: (password: string, salt?: string) => Promise<ApiResponse<HashResult>>;
  verifyPassword?: (password: string, hash: string, salt: string) => Promise<ApiResponse<boolean>>;
  randomString?: (length?: number) => Promise<ApiResponse<string>>;
  uuid?: () => Promise<ApiResponse<string>>;
  setKey?: (key: string) => Promise<ApiResponse<null>>;
}

interface FileAPI {
  importPhoto?: (sourcePath: string, existingHashes: string[]) => Promise<ApiResponse<ImportPhotoResult>>;
  importSafeFile?: (sourcePath: string, encrypt?: boolean) => Promise<ApiResponse<ImportPhotoResult>>;
  decryptSafeFile?: (storedPath: string) => Promise<ApiResponse<string>>;
  getMD5?: (filePath: string) => Promise<ApiResponse<string>>;
  getSize?: (filePath: string) => Promise<ApiResponse<number>>;
  exists?: (filePath: string) => Promise<ApiResponse<boolean>>;
  delete?: (filePath: string) => Promise<ApiResponse<boolean>>;
  readAsBase64?: (filePath: string) => Promise<ApiResponse<string | null>>;
  listPhotos?: () => Promise<ApiResponse<string[]>>;
  getPhotosDir?: () => Promise<ApiResponse<string>>;
  getSafeFilesDir?: () => Promise<ApiResponse<string>>;
  getBaseDir?: () => Promise<ApiResponse<string>>;
  formatSize?: (bytes: number) => Promise<ApiResponse<string>>;
}

interface BackupAPI {
  create?: (options?: BackupOptions) => Promise<ApiResponse<BackupResult>>;
  restore?: (backupPath: string, overwrite?: boolean) => Promise<ApiResponse<boolean>>;
  list?: () => Promise<ApiResponse<BackupRecord[]>>;
  delete?: (backupPath: string) => Promise<ApiResponse<boolean>>;
  export?: (backupPath: string, destPath: string) => Promise<ApiResponse<boolean>>;
  preview?: (backupPath: string) => Promise<ApiResponse<BackupPreview>>;
  createBackup?: (options: BackupOptions & { backupName?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  restoreBackup?: (options: { backupId: string; backupPath?: string }) => Promise<{ success: boolean; error?: string }>;
  previewBackup?: (backupPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  listBackups?: () => Promise<any[]>;
}

interface DialogAPI {
  openFile?: (options?: any) => Promise<ApiResponse<any>>;
  saveFile?: (options?: any) => Promise<ApiResponse<any>>;
  showMessageBox?: (options: any) => Promise<ApiResponse<any>>;
}

interface WindowAPI {
  minimize?: () => Promise<ApiResponse<null>>;
  maximize?: () => Promise<ApiResponse<null>>;
  close?: () => Promise<ApiResponse<null>>;
  isMaximized?: () => Promise<ApiResponse<boolean>>;
  focus?: () => Promise<ApiResponse<null>>;
}

interface ElectronAPI {
  database?: DatabaseAPI;
  crypto?: CryptoAPI;
  file?: FileAPI;
  backup?: BackupAPI;
  dialog?: DialogAPI;
  window?: WindowAPI;
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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

declare module '*.css';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';
