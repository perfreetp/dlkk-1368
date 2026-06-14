interface ElectronDatabaseAPI {
  all?: (sql: string, params?: any[]) => Promise<any[]>;
  get?: (sql: string, params?: any[]) => Promise<any>;
  run?: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
  insert?: (table: string, data: Record<string, any>) => Promise<number>;
  update?: (table: string, id: number | string, data: Record<string, any>) => Promise<boolean>;
  delete?: (table: string, id: number | string) => Promise<boolean>;
}

interface ElectronCryptoAPI {
  encrypt?: (data: string, password: string) => Promise<string>;
  decrypt?: (encrypted: string, password: string) => Promise<string>;
  hashPassword?: (password: string) => Promise<{ hash: string; salt: string }>;
  verifyPassword?: (password: string, hash: string, salt: string) => Promise<boolean>;
}

interface ElectronFileAPI {
  saveFile?: (content: string, filename: string) => Promise<string>;
  readFile?: (filepath: string) => Promise<string>;
  deleteFile?: (filepath: string) => Promise<boolean>;
  selectFile?: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  selectSaveFile?: (defaultPath?: string) => Promise<string | null>;
}

interface ElectronBackupAPI {
  createBackup?: (options: { includePhotos?: boolean; includeSafeFiles?: boolean; backupName?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  restoreBackup?: (options: { backupId: string; backupPath?: string }) => Promise<{ success: boolean; error?: string }>;
  previewBackup?: (backupPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  listBackups?: () => Promise<any[]>;
}

interface ElectronDialogAPI {
  showMessage?: (options: { type: 'info' | 'warning' | 'error' | 'question'; title: string; message: string }) => Promise<void>;
}

interface ElectronAPI {
  database?: ElectronDatabaseAPI;
  crypto?: ElectronCryptoAPI;
  file?: ElectronFileAPI;
  backup?: ElectronBackupAPI;
  dialog?: ElectronDialogAPI;
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
