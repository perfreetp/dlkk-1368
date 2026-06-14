import { ipcMain, BrowserWindow, dialog } from 'electron';
import { databaseManager, TableName, QueryOptions } from './database';
import { cryptoManager } from './crypto';
import { fileManager, ImportPhotoResult, BackupOptions, BackupResult } from './fileManager';

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

function handleError(error: unknown): { success: false; error: string } {
  return {
    success: false,
    error: error instanceof Error ? error.message : '未知错误',
  };
}

function success<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

export function registerIpcHandlers(): void {
  ipcMain.handle('db:init', () => {
    try {
      databaseManager.init();
      return success(null);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle(
    'db:insert',
    (_event, table: TableName, data: Record<string, any>) => {
      try {
        const id = databaseManager.insert(table, data);
        return success(id);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle(
    'db:update',
    (
      _event,
      table: TableName,
      id: number,
      data: Record<string, any>
    ) => {
      try {
        const result = databaseManager.update(table, id, data);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle('db:delete', (_event, table: TableName, id: number) => {
    try {
      const result = databaseManager.delete(table, id);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle(
    'db:deleteWhere',
    (_event, table: TableName, where: Record<string, any>) => {
      try {
        const result = databaseManager.deleteWhere(table, where);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle('db:findById', (_event, table: TableName, id: number) => {
    try {
      const result = databaseManager.findById(table, id);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle(
    'db:findAll',
    (_event, table: TableName, options?: QueryOptions) => {
      try {
        const result = databaseManager.findAll(table, options);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle(
    'db:findOne',
    (_event, table: TableName, options?: QueryOptions) => {
      try {
        const result = databaseManager.findOne(table, options);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle(
    'db:count',
    (_event, table: TableName, where?: Record<string, any>) => {
      try {
        const result = databaseManager.count(table, where);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle(
    'db:customQuery',
    (_event, sql: string, params?: any[]) => {
      try {
        const result = databaseManager.customQuery(sql, params);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle(
    'db:customExecute',
    (_event, sql: string, params?: any[]) => {
      try {
        const result = databaseManager.customExecute(sql, params);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle('crypto:aesEncrypt', (_event, data: string, key?: string) => {
    try {
      const result = cryptoManager.aesEncrypt(data, key);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle(
    'crypto:aesDecrypt',
    (_event, data: string, iv: string, key?: string) => {
      try {
        const result = cryptoManager.aesDecrypt(data, iv, key);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle(
    'crypto:simpleEncrypt',
    (_event, data: string, key?: string) => {
      try {
        const result = cryptoManager.simpleEncrypt(data, key);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle(
    'crypto:simpleDecrypt',
    (_event, data: string, key?: string) => {
      try {
        const result = cryptoManager.simpleDecrypt(data, key);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle('crypto:md5', (_event, data: string) => {
    try {
      const result = cryptoManager.generateMD5(data);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('crypto:sha256', (_event, data: string) => {
    try {
      const result = cryptoManager.generateSHA256(data);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('crypto:sha512', (_event, data: string) => {
    try {
      const result = cryptoManager.generateSHA512(data);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('crypto:hashPassword', (_event, password: string, salt?: string) => {
    try {
      const result = cryptoManager.hashPassword(password, salt);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle(
    'crypto:verifyPassword',
    (_event, password: string, hash: string, salt: string) => {
      try {
        const result = cryptoManager.verifyPassword(password, hash, salt);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle('crypto:randomString', (_event, length?: number) => {
    try {
      const result = cryptoManager.generateRandomString(length);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('crypto:uuid', () => {
    try {
      const result = cryptoManager.generateUUID();
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('crypto:setKey', (_event, key: string) => {
    try {
      cryptoManager.setKey(key);
      return success(null);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle(
    'file:importPhoto',
    (_event, sourcePath: string, existingHashes: string[]) => {
      try {
        const result = fileManager.importPhoto(sourcePath, existingHashes);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle(
    'file:importSafeFile',
    (_event, sourcePath: string, encrypt?: boolean) => {
      try {
        const result = fileManager.importSafeFile(sourcePath, encrypt);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle('file:decryptSafeFile', (_event, storedPath: string) => {
    try {
      const result = fileManager.decryptSafeFile(storedPath);
      if (result) {
        return success(result.toString('base64'));
      }
      return handleError(new Error('解密失败'));
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:getMD5', (_event, filePath: string) => {
    try {
      const result = fileManager.getFileMD5(filePath);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:getSize', (_event, filePath: string) => {
    try {
      const result = fileManager.getFileSize(filePath);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:exists', (_event, filePath: string) => {
    try {
      const result = fileManager.fileExists(filePath);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:delete', (_event, filePath: string) => {
    try {
      const result = fileManager.deleteFile(filePath);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:readAsBase64', (_event, filePath: string) => {
    try {
      const result = fileManager.readFileAsBase64(filePath);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:listPhotos', () => {
    try {
      const result = fileManager.listPhotos();
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:getPhotosDir', () => {
    try {
      const result = fileManager.getPhotosDir();
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:getSafeFilesDir', () => {
    try {
      const result = fileManager.getSafeFilesDir();
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:getBaseDir', () => {
    try {
      const result = fileManager.getBaseDir();
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('file:formatSize', (_event, bytes: number) => {
    try {
      const result = fileManager.formatFileSize(bytes);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('backup:create', (_event, options?: BackupOptions) => {
    try {
      const result = fileManager.createBackup(options);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle(
    'backup:restore',
    (_event, backupPath: string, overwrite?: boolean) => {
      try {
        const result = fileManager.restoreBackup(backupPath, overwrite);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle('backup:list', () => {
    try {
      const result = fileManager.listBackups();
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('backup:delete', (_event, backupPath: string) => {
    try {
      const result = fileManager.deleteBackup(backupPath);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle(
    'backup:export',
    (_event, backupPath: string, destPath: string) => {
      try {
        const result = fileManager.exportBackupToLocation(backupPath, destPath);
        return success(result);
      } catch (error) {
        return handleError(error);
      }
    }
  );

  ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
      return success(null);
    }
    return handleError(new Error('窗口未初始化'));
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return success(null);
    }
    return handleError(new Error('窗口未初始化'));
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) {
      mainWindow.close();
      return success(null);
    }
    return handleError(new Error('窗口未初始化'));
  });

  ipcMain.handle('window:isMaximized', () => {
    if (mainWindow) {
      return success(mainWindow.isMaximized());
    }
    return handleError(new Error('窗口未初始化'));
  });

  ipcMain.handle('window:focus', () => {
    if (mainWindow) {
      mainWindow.focus();
      return success(null);
    }
    return handleError(new Error('窗口未初始化'));
  });

  ipcMain.handle('dialog:openFile', async (_event, options?: Electron.OpenDialogOptions) => {
    try {
      if (!mainWindow) {
        return handleError(new Error('窗口未初始化'));
      }
      const result = await dialog.showOpenDialog(mainWindow, options || {});
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('dialog:saveFile', async (_event, options?: Electron.SaveDialogOptions) => {
    try {
      if (!mainWindow) {
        return handleError(new Error('窗口未初始化'));
      }
      const result = await dialog.showSaveDialog(mainWindow, options || {});
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });

  ipcMain.handle('dialog:showMessageBox', async (_event, options: Electron.MessageBoxOptions) => {
    try {
      if (!mainWindow) {
        return handleError(new Error('窗口未初始化'));
      }
      const result = await dialog.showMessageBox(mainWindow, options);
      return success(result);
    } catch (error) {
      return handleError(error);
    }
  });
}
