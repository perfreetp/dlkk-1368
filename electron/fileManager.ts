import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { cryptoManager } from './crypto';

export interface ImportPhotoResult {
  success: boolean;
  file_path?: string;
  file_name?: string;
  file_hash?: string;
  file_size?: number;
  isDuplicate?: boolean;
  error?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingPath?: string;
  hash: string;
}

export interface BackupOptions {
  includePhotos?: boolean;
  includeSafeFiles?: boolean;
  backupName?: string;
}

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  fileSize?: number;
  error?: string;
}

class FileManager {
  private baseDir: string = '';
  private photosDir: string = '';
  private safeFilesDir: string = '';
  private backupsDir: string = '';
  private tempDir: string = '';

  constructor() {}

  private initDirs(): void {
    if (this.baseDir) return;

    this.baseDir = path.join(app.getPath('userData'), 'appData');
    this.photosDir = path.join(this.baseDir, 'photos');
    this.safeFilesDir = path.join(this.baseDir, 'safe_files');
    this.backupsDir = path.join(this.baseDir, 'backups');
    this.tempDir = path.join(this.baseDir, 'temp');

    this.ensureDir(this.baseDir);
    this.ensureDir(this.photosDir);
    this.ensureDir(this.safeFilesDir);
    this.ensureDir(this.backupsDir);
    this.ensureDir(this.tempDir);
  }

  ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  getBaseDir(): string {
    this.initDirs();
    return this.baseDir;
  }

  getPhotosDir(): string {
    this.initDirs();
    return this.photosDir;
  }

  getSafeFilesDir(): string {
    this.initDirs();
    return this.safeFilesDir;
  }

  getBackupsDir(): string {
    this.initDirs();
    return this.backupsDir;
  }

  getTempDir(): string {
    this.initDirs();
    return this.tempDir;
  }

  generateUniqueFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${baseName}_${timestamp}_${random}${ext}`;
  }

  getFileMD5(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return cryptoManager.generateMD5(fileBuffer.toString('base64'));
  }

  getFileSize(filePath: string): number {
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  checkDuplicate(filePath: string, existingHashes: string[]): DuplicateCheckResult {
    const hash = this.getFileMD5(filePath);
    const isDuplicate = existingHashes.includes(hash);
    return {
      isDuplicate,
      hash,
    };
  }

  copyFile(sourcePath: string, destPath: string): boolean {
    try {
      this.ensureDir(path.dirname(destPath));
      fs.copyFileSync(sourcePath, destPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  moveFile(sourcePath: string, destPath: string): boolean {
    try {
      this.ensureDir(path.dirname(destPath));
      fs.renameSync(sourcePath, destPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  deleteFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  readFileAsBase64(filePath: string): string | null {
    try {
      const buffer = fs.readFileSync(filePath);
      return buffer.toString('base64');
    } catch (error) {
      return null;
    }
  }

  readFileAsBuffer(filePath: string): Buffer | null {
    try {
      return fs.readFileSync(filePath);
    } catch (error) {
      return null;
    }
  }

  writeBufferToFile(filePath: string, buffer: Buffer): boolean {
    try {
      this.ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, buffer);
      return true;
    } catch (error) {
      return false;
    }
  }

  importPhoto(sourcePath: string, existingHashes: string[]): ImportPhotoResult {
    this.initDirs();

    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源文件不存在' };
    }

    try {
      const hash = this.getFileMD5(sourcePath);

      if (existingHashes.includes(hash)) {
        return {
          success: false,
          isDuplicate: true,
          file_hash: hash,
          error: '文件已存在',
        };
      }

      const fileName = this.generateUniqueFileName(path.basename(sourcePath));
      const destPath = path.join(this.photosDir, fileName);
      const fileSize = this.getFileSize(sourcePath);

      const copied = this.copyFile(sourcePath, destPath);
      if (!copied) {
        return { success: false, error: '文件复制失败' };
      }

      return {
        success: true,
        file_path: destPath,
        file_name: fileName,
        file_hash: hash,
        file_size: fileSize,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '导入失败',
      };
    }
  }

  importSafeFile(sourcePath: string, encrypt: boolean = true): ImportPhotoResult {
    this.initDirs();

    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源文件不存在' };
    }

    try {
      const hash = this.getFileMD5(sourcePath);
      const fileName = this.generateUniqueFileName(path.basename(sourcePath));
      let destPath = path.join(this.safeFilesDir, fileName);
      const fileSize = this.getFileSize(sourcePath);

      if (encrypt) {
        const fileBuffer = fs.readFileSync(sourcePath);
        const encrypted = cryptoManager.simpleEncrypt(
          fileBuffer.toString('base64')
        );
        fs.writeFileSync(destPath, encrypted);
      } else {
        this.copyFile(sourcePath, destPath);
      }

      return {
        success: true,
        file_path: destPath,
        file_name: fileName,
        file_hash: hash,
        file_size: fileSize,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '导入失败',
      };
    }
  }

  decryptSafeFile(storedPath: string): Buffer | null {
    try {
      const encrypted = fs.readFileSync(storedPath, 'utf-8');
      const decryptedBase64 = cryptoManager.simpleDecrypt(encrypted);
      return Buffer.from(decryptedBase64, 'base64');
    } catch (error) {
      return null;
    }
  }

  listPhotos(): string[] {
    this.initDirs();
    if (!fs.existsSync(this.photosDir)) return [];
    return fs.readdirSync(this.photosDir).map((name) =>
      path.join(this.photosDir, name)
    );
  }

  createBackup(options: BackupOptions = {}): BackupResult {
    this.initDirs();

    try {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_');
      const backupName = options.backupName || `backup_${timestamp}`;
      const backupFileName = `${backupName}.gz`;
      const backupPath = path.join(this.backupsDir, backupFileName);

      const tempBackupDir = path.join(this.tempDir, `backup_${timestamp}`);
      this.ensureDir(tempBackupDir);

      const dbPath = path.join(this.baseDir, 'couple_space.db');
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, path.join(tempBackupDir, 'couple_space.db'));
      }

      if (options.includePhotos && fs.existsSync(this.photosDir)) {
        const destPhotosDir = path.join(tempBackupDir, 'photos');
        this.ensureDir(destPhotosDir);
        const files = fs.readdirSync(this.photosDir);
        for (const file of files) {
          fs.copyFileSync(
            path.join(this.photosDir, file),
            path.join(destPhotosDir, file)
          );
        }
      }

      if (options.includeSafeFiles && fs.existsSync(this.safeFilesDir)) {
        const destSafeDir = path.join(tempBackupDir, 'safe_files');
        this.ensureDir(destSafeDir);
        const files = fs.readdirSync(this.safeFilesDir);
        for (const file of files) {
          fs.copyFileSync(
            path.join(this.safeFilesDir, file),
            path.join(destSafeDir, file)
          );
        }
      }

      this.compressDirectory(tempBackupDir, backupPath);

      const fileSize = fs.existsSync(backupPath)
        ? fs.statSync(backupPath).size
        : 0;

      this.removeDirectory(tempBackupDir);

      return {
        success: true,
        backupPath,
        fileSize,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '备份失败',
      };
    }
  }

  private compressDirectory(sourceDir: string, destFile: string): void {
    const tar = require('tar');
    const gzip = zlib.createGzip();
    const output = fs.createWriteStream(destFile);

    tar.c(
      {
        cwd: sourceDir,
      },
      ['.']
    )
      .pipe(gzip)
      .pipe(output);

    return new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    }) as unknown as void;
  }

  restoreBackup(backupPath: string, overwrite: boolean = true): boolean {
    this.initDirs();

    if (!fs.existsSync(backupPath)) {
      return false;
    }

    try {
      const timestamp = Date.now().toString();
      const restoreDir = path.join(this.tempDir, `restore_${timestamp}`);
      this.ensureDir(restoreDir);

      this.decompressFile(backupPath, restoreDir);

      const dbPath = path.join(restoreDir, 'couple_space.db');
      const destDbPath = path.join(this.baseDir, 'couple_space.db');

      if (fs.existsSync(dbPath)) {
        if (overwrite || !fs.existsSync(destDbPath)) {
          fs.copyFileSync(dbPath, destDbPath);
        }
      }

      const srcPhotosDir = path.join(restoreDir, 'photos');
      if (fs.existsSync(srcPhotosDir)) {
        const files = fs.readdirSync(srcPhotosDir);
        for (const file of files) {
          const destPath = path.join(this.photosDir, file);
          if (overwrite || !fs.existsSync(destPath)) {
            fs.copyFileSync(path.join(srcPhotosDir, file), destPath);
          }
        }
      }

      const srcSafeDir = path.join(restoreDir, 'safe_files');
      if (fs.existsSync(srcSafeDir)) {
        const files = fs.readdirSync(srcSafeDir);
        for (const file of files) {
          const destPath = path.join(this.safeFilesDir, file);
          if (overwrite || !fs.existsSync(destPath)) {
            fs.copyFileSync(path.join(srcSafeDir, file), destPath);
          }
        }
      }

      this.removeDirectory(restoreDir);
      return true;
    } catch (error) {
      return false;
    }
  }

  private decompressFile(sourceFile: string, destDir: string): void {
    const tar = require('tar');
    const gunzip = zlib.createGunzip();
    const input = fs.createReadStream(sourceFile);

    input
      .pipe(gunzip)
      .pipe(
        tar.x({
          cwd: destDir,
        })
      );

    return new Promise<void>((resolve, reject) => {
      input.on('close', resolve);
      input.on('error', reject);
    }) as unknown as void;
  }

  removeDirectory(dirPath: string): boolean {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  exportBackupToLocation(backupPath: string, destPath: string): boolean {
    try {
      this.copyFile(backupPath, destPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  listBackups(): Array<{
    name: string;
    path: string;
    size: number;
    created: Date;
  }> {
    this.initDirs();
    if (!fs.existsSync(this.backupsDir)) return [];

    const files = fs.readdirSync(this.backupsDir);
    return files
      .filter((f) => f.endsWith('.gz'))
      .map((name) => {
        const fullPath = path.join(this.backupsDir, name);
        const stats = fs.statSync(fullPath);
        return {
          name,
          path: fullPath,
          size: stats.size,
          created: stats.birthtime,
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  deleteBackup(backupPath: string): boolean {
    return this.deleteFile(backupPath);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const fileManager = new FileManager();
export default FileManager;
