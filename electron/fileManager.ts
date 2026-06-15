import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { cryptoManager } from './crypto';
import { databaseManager, Photo, SafeFile, Backup } from './database';

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
  backupId?: number;
  error?: string;
}

export interface DeleteBackupResult {
  dbRecordDeleted: boolean;
  dbRecordCount: number;
  fileDeleted: boolean;
  fileStillExists: boolean;
  filePath: string;
  errors: string[];
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

const TAR_BLOCK_SIZE = 512;
const BACKUP_VERSION = '1.0.0';

function padToBlockSize(buffer: Buffer): Buffer {
  const remainder = buffer.length % TAR_BLOCK_SIZE;
  if (remainder === 0) return buffer;
  const padded = Buffer.alloc(buffer.length + (TAR_BLOCK_SIZE - remainder));
  buffer.copy(padded);
  return padded;
}

function createTarHeader(
  fileName: string,
  fileSize: number,
  mode: number = 0o644,
  uid: number = 0,
  gid: number = 0,
  mtime: number = Math.floor(Date.now() / 1000),
  typeflag: string = '0',
  linkname: string = '',
  uname: string = '',
  gname: string = '',
  devmajor: number = 0,
  devminor: number = 0
): Buffer {
  const header = Buffer.alloc(TAR_BLOCK_SIZE);
  let offset = 0;

  const nameBuf = Buffer.from(fileName, 'utf-8');
  nameBuf.copy(header, offset, 0, Math.min(nameBuf.length, 100));
  offset += 100;

  header.write(mode.toString(8).padStart(7, '0') + '\0', offset, 8, 'utf-8');
  offset += 8;

  header.write(uid.toString(8).padStart(7, '0') + '\0', offset, 8, 'utf-8');
  offset += 8;

  header.write(gid.toString(8).padStart(7, '0') + '\0', offset, 8, 'utf-8');
  offset += 8;

  header.write(fileSize.toString(8).padStart(11, '0') + '\0', offset, 12, 'utf-8');
  offset += 12;

  header.write(mtime.toString(8).padStart(11, '0') + '\0', offset, 12, 'utf-8');
  offset += 12;

  offset += 8;

  header.write(typeflag, offset, 1, 'utf-8');
  offset += 1;

  const linknameBuf = Buffer.from(linkname, 'utf-8');
  linknameBuf.copy(header, offset, 0, Math.min(linknameBuf.length, 100));
  offset += 100;

  header.write('ustar\0', offset, 6, 'utf-8');
  offset += 6;

  header.write('00', offset, 2, 'utf-8');
  offset += 2;

  const unameBuf = Buffer.from(uname, 'utf-8');
  unameBuf.copy(header, offset, 0, Math.min(unameBuf.length, 32));
  offset += 32;

  const gnameBuf = Buffer.from(gname, 'utf-8');
  gnameBuf.copy(header, offset, 0, Math.min(gnameBuf.length, 32));
  offset += 32;

  header.write(devmajor.toString(8).padStart(7, '0') + '\0', offset, 8, 'utf-8');
  offset += 8;

  header.write(devminor.toString(8).padStart(7, '0') + '\0', offset, 8, 'utf-8');
  offset += 8;

  let checksum = 0;
  for (let i = 0; i < TAR_BLOCK_SIZE; i++) {
    checksum += header[i];
  }
  for (let i = 0; i < 8; i++) {
    checksum += 32;
  }
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf-8');

  return header;
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

  private tarPack(sourceDir: string, destFile: string): void {
    const collected: Array<{ relativePath: string; fullPath: string; stats: fs.Stats }> = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(sourceDir, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          collected.push({
            relativePath,
            fullPath,
            stats: fs.statSync(fullPath),
          });
        }
      }
    };
    walk(sourceDir);

    const writeStream = fs.createWriteStream(destFile);
    const gzip = zlib.createGzip();
    const piped = writeStream;
    const gzStream = zlib.createGzip();

    for (const item of collected) {
      const header = createTarHeader(
        item.relativePath,
        item.stats.size,
        item.stats.mode,
        0,
        0,
        Math.floor(item.stats.mtimeMs / 1000)
      );
      gzStream.write(header);

      const content = fs.readFileSync(item.fullPath);
      const padded = padToBlockSize(content);
      gzStream.write(padded);
    }

    const eof = Buffer.alloc(TAR_BLOCK_SIZE * 2);
    gzStream.write(eof);
    gzStream.end();

    gzStream.pipe(writeStream);

    return new Promise<void>((resolve, reject) => {
      writeStream.on('close', resolve);
      writeStream.on('error', reject);
    }) as unknown as void;
  }

  private tarPackSync(sourceDir: string, destFile: string): void {
    const collected: Array<{ relativePath: string; fullPath: string; stats: fs.Stats }> = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(sourceDir, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          collected.push({
            relativePath,
            fullPath,
            stats: fs.statSync(fullPath),
          });
        }
      }
    };
    walk(sourceDir);

    const chunks: Buffer[] = [];

    for (const item of collected) {
      const header = createTarHeader(
        item.relativePath,
        item.stats.size,
        item.stats.mode,
        0,
        0,
        Math.floor(item.stats.mtimeMs / 1000)
      );
      chunks.push(header);

      const content = fs.readFileSync(item.fullPath);
      const padded = padToBlockSize(content);
      chunks.push(padded);
    }

    chunks.push(Buffer.alloc(TAR_BLOCK_SIZE * 2));

    const tarBuffer = Buffer.concat(chunks);
    const gzipped = zlib.gzipSync(tarBuffer);
    fs.writeFileSync(destFile, gzipped);
  }

  private tarUnpackSync(sourceFile: string, destDir: string): void {
    this.ensureDir(destDir);
    const gzipped = fs.readFileSync(sourceFile);
    const tarBuffer = zlib.gunzipSync(gzipped);

    let offset = 0;
    let emptyBlocks = 0;

    while (offset + TAR_BLOCK_SIZE <= tarBuffer.length) {
      const header = tarBuffer.slice(offset, offset + TAR_BLOCK_SIZE);
      offset += TAR_BLOCK_SIZE;

      let isEmpty = true;
      for (let i = 0; i < TAR_BLOCK_SIZE; i++) {
        if (header[i] !== 0) {
          isEmpty = false;
          break;
        }
      }
      if (isEmpty) {
        emptyBlocks++;
        if (emptyBlocks >= 2) break;
        continue;
      }
      emptyBlocks = 0;

      const fileName = this.readTarString(header, 0, 100);
      const fileSize = parseInt(this.readTarString(header, 124, 12).trim(), 8);
      const typeflag = header[156];

      if (!fileName || (typeflag !== 48 && typeflag !== 0)) {
        offset += Math.ceil(fileSize / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
        continue;
      }

      const safeFileName = fileName.replace(/\.\./g, '_').replace(/^[\/\\]/, '');
      const destPath = path.join(destDir, safeFileName);
      this.ensureDir(path.dirname(destPath));

      const contentSize = fileSize;
      const paddedSize = Math.ceil(contentSize / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;

      if (offset + contentSize <= tarBuffer.length) {
        const content = tarBuffer.slice(offset, offset + contentSize);
        fs.writeFileSync(destPath, content);
      }

      offset += paddedSize;
    }
  }

  private readTarString(buffer: Buffer, start: number, length: number): string {
    let end = start + length;
    for (let i = start; i < start + length; i++) {
      if (buffer[i] === 0) {
        end = i;
        break;
      }
    }
    return buffer.toString('utf-8', start, end);
  }

  private collectTableStats(): Record<string, number> {
    const tables = [
      'timeline_events',
      'letters',
      'photos',
      'travels',
      'receipts',
      'goals',
      'tasks',
      'keepsakes',
      'temperature_records',
      'safe_files',
      'backups',
      'settings',
    ];
    const stats: Record<string, number> = {};
    for (const table of tables) {
      try {
        stats[table] = databaseManager.count(table as any);
      } catch {
        stats[table] = 0;
      }
    }
    return stats;
  }

  createBackup(options: BackupOptions = {}): BackupResult {
    this.initDirs();

    let tempBackupDir = '';

    try {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_');
      const backupName = options.backupName || `backup_${timestamp}`;
      const backupFileName = `${backupName}.tar.gz`;
      const backupPath = path.join(this.backupsDir, backupFileName);

      tempBackupDir = path.join(this.tempDir, `backup_${timestamp}_${process.pid}`);
      this.ensureDir(tempBackupDir);

      const dbPath = databaseManager.getDbPath() || path.join(this.baseDir, 'couple_space.db');
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: '数据库文件不存在' };
      }

      try {
        const db = databaseManager.getConnection();
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {}

      const snapshotDbPath = path.join(tempBackupDir, 'couple_space.db');
      fs.copyFileSync(dbPath, snapshotDbPath);

      const walPath = dbPath + '-wal';
      if (fs.existsSync(walPath)) {
        try { fs.unlinkSync(walPath); } catch {}
      }
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(shmPath)) {
        try { fs.unlinkSync(shmPath); } catch {}
      }

      const missingFiles: string[] = [];
      let photoCount = 0;
      let safeFileCount = 0;

      const photoManifest: PhotoManifest = { entries: [] };
      if (options.includePhotos) {
        const destPhotosDir = path.join(tempBackupDir, 'photos');
        this.ensureDir(destPhotosDir);

        try {
          const photos = databaseManager.findAll<Photo>('photos');
          for (const photo of photos) {
            if (!photo.id || !photo.file_path) continue;
            if (!fs.existsSync(photo.file_path)) {
              missingFiles.push(`photo[${photo.id}]: ${photo.file_path}`);
              continue;
            }
            const storedFileName = `photo_${photo.id}${path.extname(photo.file_path)}`;
            const storedPath = path.join(destPhotosDir, storedFileName);
            try {
              fs.copyFileSync(photo.file_path, storedPath);
              photoManifest.entries.push({
                id: photo.id,
                originalPath: photo.file_path,
                storedPath: `photos/${storedFileName}`,
                fileHash: photo.file_hash,
                fileSize: photo.file_size,
              });
              photoCount++;
            } catch {
              missingFiles.push(`photo[${photo.id}] copy failed: ${photo.file_path}`);
            }
          }
        } catch {}

        fs.writeFileSync(
          path.join(tempBackupDir, 'photo_manifest.json'),
          JSON.stringify(photoManifest, null, 2)
        );
      }

      const safeFileManifest: SafeFileManifest = { entries: [] };
      if (options.includeSafeFiles) {
        const destSafeDir = path.join(tempBackupDir, 'safe');
        this.ensureDir(destSafeDir);

        try {
          const safeFiles = databaseManager.findAll<SafeFile>('safe_files');
          for (const sf of safeFiles) {
            if (!sf.id || !sf.stored_path) continue;
            if (!fs.existsSync(sf.stored_path)) {
              missingFiles.push(`safe_file[${sf.id}]: ${sf.stored_path}`);
              continue;
            }
            const storedFileName = `safe_${sf.id}${path.extname(sf.stored_path)}`;
            const storedPath = path.join(destSafeDir, storedFileName);
            try {
              fs.copyFileSync(sf.stored_path, storedPath);
              safeFileManifest.entries.push({
                id: sf.id,
                originalStoredPath: sf.stored_path,
                storedPath: `safe/${storedFileName}`,
                fileHash: sf.file_hash,
                fileSize: sf.file_size,
                originalName: sf.original_name,
              });
              safeFileCount++;
            } catch {
              missingFiles.push(`safe_file[${sf.id}] copy failed: ${sf.stored_path}`);
            }
          }
        } catch {}

        fs.writeFileSync(
          path.join(tempBackupDir, 'safe_manifest.json'),
          JSON.stringify(safeFileManifest, null, 2)
        );
      }

      const manifest: BackupManifest = {
        backupTime: new Date().toISOString(),
        version: BACKUP_VERSION,
        includePhotos: !!options.includePhotos,
        includeSafeFiles: !!options.includeSafeFiles,
        dbFileName: 'couple_space.db',
        tableStats: this.collectTableStats(),
        missingFiles: missingFiles.length > 0 ? missingFiles : undefined,
        photoCount,
        safeFileCount,
      };
      fs.writeFileSync(
        path.join(tempBackupDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      this.tarPackSync(tempBackupDir, backupPath);

      const fileSize = fs.existsSync(backupPath)
        ? fs.statSync(backupPath).size
        : 0;

      const backupType = [
        options.includePhotos ? 'photos' : '',
        options.includeSafeFiles ? 'safe' : '',
      ].filter(Boolean).join('+') || 'db-only';

      const descriptionParts: string[] = [];
      if (options.includePhotos) descriptionParts.push(`${photoCount}张照片`);
      if (options.includeSafeFiles) descriptionParts.push(`${safeFileCount}个安全文件`);
      if (missingFiles.length > 0) descriptionParts.push(`${missingFiles.length}个文件缺失`);

      let backupId: number | undefined;
      try {
        backupId = databaseManager.insert<Backup>('backups', {
          backup_name: backupName,
          file_path: backupPath,
          file_size: fileSize,
          backup_type: backupType,
          description: descriptionParts.join('，') || '仅数据库',
          created_at: new Date().toISOString(),
        });
      } catch (insertError) {
        console.error('[Backup] 插入备份记录到数据库失败:', insertError);
      }

      if (missingFiles.length > 0) {
        console.warn(`[Backup] 备份完成，但有 ${missingFiles.length} 个文件缺失`);
      }

      this.removeDirectory(tempBackupDir);

      return {
        success: true,
        filePath: backupPath,
        fileSize,
        manifest,
        photoCount,
        safeFileCount,
        backupId,
      };
    } catch (error) {
      if (tempBackupDir) {
        try { this.removeDirectory(tempBackupDir); } catch {}
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : '备份失败',
      };
    }
  }

  restoreBackup(backupPath: string, overwrite: boolean = true): boolean {
    this.initDirs();

    if (!fs.existsSync(backupPath)) {
      throw new Error('备份文件不存在');
    }

    let restoreDir = '';
    let preRestoreDbPath = '';

    try {
      const timestamp = Date.now();
      restoreDir = path.join(this.tempDir, `restore_${timestamp}_${process.pid}`);
      this.ensureDir(restoreDir);

      this.tarUnpackSync(backupPath, restoreDir);

      const manifestPath = path.join(restoreDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('无效的备份包：缺少 manifest.json');
      }
      const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (!manifest.version || !manifest.dbFileName) {
        throw new Error('无效的备份包：manifest 格式错误');
      }

      const srcDbPath = path.join(restoreDir, manifest.dbFileName);
      if (!fs.existsSync(srcDbPath)) {
        throw new Error('无效的备份包：缺少数据库文件');
      }

      const currentDbPath = databaseManager.getDbPath() || path.join(this.baseDir, 'couple_space.db');
      preRestoreDbPath = `${currentDbPath}.pre-restore-${timestamp}`;
      if (fs.existsSync(currentDbPath)) {
        fs.copyFileSync(currentDbPath, preRestoreDbPath);
      }

      try {
        databaseManager.close();
      } catch {}

      try {
        fs.copyFileSync(srcDbPath, currentDbPath);
        const walPath = currentDbPath + '-wal';
        if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch {}
        const shmPath = currentDbPath + '-shm';
        if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch {}
      } catch (e) {
        if (fs.existsSync(preRestoreDbPath)) {
          try { fs.copyFileSync(preRestoreDbPath, currentDbPath); } catch {}
        }
        try { databaseManager.init(); } catch {}
        throw e;
      }

      try {
        databaseManager.init();
        const db = databaseManager.getConnection();
        const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
        if (integrity.length === 0 || integrity[0].integrity_check !== 'ok') {
          throw new Error('数据库完整性检查失败');
        }
      } catch (e) {
        if (fs.existsSync(preRestoreDbPath)) {
          try {
            databaseManager.close();
            fs.copyFileSync(preRestoreDbPath, currentDbPath);
            databaseManager.init();
          } catch {}
        }
        throw e;
      }

      if (manifest.includePhotos) {
        const photoManifestPath = path.join(restoreDir, 'photo_manifest.json');
        if (fs.existsSync(photoManifestPath)) {
          const photoManifest: PhotoManifest = JSON.parse(fs.readFileSync(photoManifestPath, 'utf-8'));
          for (const entry of photoManifest.entries) {
            try {
              const archivePath = path.join(restoreDir, entry.storedPath);
              if (!fs.existsSync(archivePath)) continue;
              const targetPath = entry.originalPath;
              if (fs.existsSync(targetPath) && !overwrite) continue;
              if (fs.existsSync(targetPath)) {
                try {
                  const targetSize = fs.statSync(targetPath).size;
                  if (targetSize === entry.fileSize) continue;
                } catch {}
              }
              this.ensureDir(path.dirname(targetPath));
              fs.copyFileSync(archivePath, targetPath);
            } catch {}
          }
        }
      }

      if (manifest.includeSafeFiles) {
        const safeManifestPath = path.join(restoreDir, 'safe_manifest.json');
        if (fs.existsSync(safeManifestPath)) {
          const safeManifest: SafeFileManifest = JSON.parse(fs.readFileSync(safeManifestPath, 'utf-8'));
          for (const entry of safeManifest.entries) {
            try {
              const archivePath = path.join(restoreDir, entry.storedPath);
              if (!fs.existsSync(archivePath)) continue;
              const targetPath = entry.originalStoredPath;
              if (fs.existsSync(targetPath) && !overwrite) continue;
              if (fs.existsSync(targetPath)) {
                try {
                  const targetSize = fs.statSync(targetPath).size;
                  if (targetSize === entry.fileSize) continue;
                } catch {}
              }
              this.ensureDir(path.dirname(targetPath));
              fs.copyFileSync(archivePath, targetPath);
            } catch {}
          }
        }
      }

      try {
        if (fs.existsSync(preRestoreDbPath)) {
          fs.unlinkSync(preRestoreDbPath);
        }
      } catch {}

      try {
        this.removeDirectory(restoreDir);
      } catch {}

      return true;
    } catch (error) {
      if (preRestoreDbPath && fs.existsSync(preRestoreDbPath)) {
        try {
          databaseManager.close();
          const currentDbPath = databaseManager.getDbPath() || path.join(this.baseDir, 'couple_space.db');
          fs.copyFileSync(preRestoreDbPath, currentDbPath);
          databaseManager.init();
          try { fs.unlinkSync(preRestoreDbPath); } catch {}
        } catch {}
      }
      if (restoreDir) {
        try { this.removeDirectory(restoreDir); } catch {}
      }
      throw error instanceof Error ? error : new Error('恢复失败');
    }
  }

  previewBackup(backupPath: string): BackupPreview {
    if (!fs.existsSync(backupPath)) {
      throw new Error('备份文件不存在');
    }

    const timestamp = Date.now();
    const previewDir = path.join(this.tempDir, `preview_${timestamp}_${process.pid}`);

    try {
      this.ensureDir(previewDir);
      this.tarUnpackSync(backupPath, previewDir);

      const manifestPath = path.join(previewDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('无效的备份包：缺少 manifest.json');
      }
      const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      const result: BackupPreview = { manifest };

      if (manifest.includePhotos) {
        const photoManifestPath = path.join(previewDir, 'photo_manifest.json');
        if (fs.existsSync(photoManifestPath)) {
          result.photoManifest = JSON.parse(fs.readFileSync(photoManifestPath, 'utf-8'));
        }
      }

      if (manifest.includeSafeFiles) {
        const safeManifestPath = path.join(previewDir, 'safe_manifest.json');
        if (fs.existsSync(safeManifestPath)) {
          result.safeFileManifest = JSON.parse(fs.readFileSync(safeManifestPath, 'utf-8'));
        }
      }

      try {
        this.removeDirectory(previewDir);
      } catch (cleanupError) {
        console.warn('[Preview] 清理预览临时目录失败:', cleanupError);
      }

      return result;
    } catch (error) {
      try {
        this.removeDirectory(previewDir);
      } catch {}
      throw error;
    }
  }

  listBackups(): BackupRecord[] {
    this.initDirs();

    try {
      const backups = databaseManager.findAll<Backup>('backups', {
        orderBy: 'created_at',
        orderDirection: 'DESC',
      });

      return backups.map((b) => ({
        ...b,
        fileExists: fs.existsSync(b.file_path),
      }));
    } catch {
      return [];
    }
  }

  deleteBackup(backupPath: string): DeleteBackupResult {
    const result: DeleteBackupResult = {
      dbRecordDeleted: false,
      dbRecordCount: 0,
      fileDeleted: false,
      fileStillExists: false,
      filePath: backupPath,
      errors: [],
    };

    try {
      let backups: Backup[] = [];
      try {
        backups = databaseManager.findAll<Backup>('backups', {
          where: { file_path: backupPath } as any,
        });
      } catch (findError) {
        result.errors.push(`查询备份记录失败: ${findError instanceof Error ? findError.message : String(findError)}`);
      }

      result.dbRecordCount = backups.length;

      for (const b of backups) {
        if (b.id) {
          try {
            const deleted = databaseManager.delete('backups', b.id);
            if (deleted) {
              result.dbRecordCount--;
            }
          } catch (deleteError) {
            result.errors.push(`删除备份记录[id=${b.id}]失败: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
          }
        }
      }

      result.dbRecordDeleted = result.dbRecordCount === 0;
    } catch (dbError) {
      result.errors.push(`数据库操作异常: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    try {
      if (fs.existsSync(backupPath)) {
        result.fileDeleted = this.deleteFile(backupPath);
        if (!result.fileDeleted) {
          result.errors.push('删除备份文件操作返回失败');
        }
      }
    } catch (fileError) {
      result.fileDeleted = false;
      result.errors.push(`删除备份文件异常: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
    }

    try {
      result.fileStillExists = fs.existsSync(backupPath);
    } catch (checkError) {
      result.errors.push(`检查文件是否存在失败: ${checkError instanceof Error ? checkError.message : String(checkError)}`);
    }

    return result;
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
