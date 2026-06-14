import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface TimelineEvent {
  id?: number;
  title: string;
  description?: string;
  event_date: string;
  category: string;
  photo_ids?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Letter {
  id?: number;
  title: string;
  content: string;
  sender: string;
  recipient: string;
  is_encrypted: number;
  mood?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Photo {
  id?: number;
  title?: string;
  description?: string;
  file_path: string;
  file_name: string;
  file_hash: string;
  file_size: number;
  album_id?: number;
  is_encrypted: number;
  taken_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Travel {
  id?: number;
  title: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date?: string;
  photo_ids?: string;
  cost?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Receipt {
  id?: number;
  title: string;
  category: string;
  amount: number;
  currency: string;
  paid_by?: string;
  date: string;
  description?: string;
  photo_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Goal {
  id?: number;
  title: string;
  description?: string;
  target_date?: string;
  status: string;
  progress: number;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id?: number;
  title: string;
  description?: string;
  due_date?: string;
  priority: string;
  status: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Keepsake {
  id?: number;
  title: string;
  description?: string;
  category: string;
  location?: string;
  date?: string;
  photo_ids?: string;
  is_encrypted: number;
  created_at?: string;
  updated_at?: string;
}

export interface TemperatureRecord {
  id?: number;
  temperature: number;
  measured_at: string;
  measured_by?: string;
  note?: string;
  created_at?: string;
}

export interface SafeFile {
  id?: number;
  title: string;
  original_name: string;
  stored_path: string;
  file_hash: string;
  file_size: number;
  category?: string;
  is_encrypted: number;
  created_at?: string;
  updated_at?: string;
}

export interface Backup {
  id?: number;
  backup_name: string;
  file_path: string;
  file_size: number;
  backup_type: string;
  description?: string;
  created_at?: string;
}

export interface Setting {
  id?: number;
  key: string;
  value?: string;
  description?: string;
  updated_at?: string;
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

class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string = '';

  constructor() {}

  private getDataDir(): string {
    const dataDir = path.join(app.getPath('userData'), 'appData');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
  }

  init(): void {
    if (this.db) return;

    const dataDir = this.getDataDir();
    this.dbPath = path.join(dataDir, 'couple_space.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createTables();
    this.initDefaultSettings();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        event_date TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        photo_ids TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        is_encrypted INTEGER DEFAULT 0,
        mood TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        album_id INTEGER,
        is_encrypted INTEGER DEFAULT 0,
        taken_at TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS travels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT,
        photo_ids TEXT,
        cost REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CNY',
        paid_by TEXT,
        date TEXT NOT NULL,
        description TEXT,
        photo_id INTEGER,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        target_date TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        category TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        assigned_to TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS keepsakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        location TEXT,
        date TEXT,
        photo_ids TEXT,
        is_encrypted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS temperature_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL NOT NULL,
        measured_at TEXT NOT NULL,
        measured_by TEXT,
        note TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS safe_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        category TEXT,
        is_encrypted INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        backup_type TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);
  }

  private initDefaultSettings(): void {
    if (!this.db) return;

    const defaults: Array<{ key: string; value: string; description: string }> = [
      { key: 'app_name', value: '情侣私密空间', description: '应用名称' },
      { key: 'password_hash', value: '', description: '密码哈希' },
      { key: 'password_salt', value: '', description: '密码盐值' },
      { key: 'encryption_key', value: '', description: '加密密钥' },
      { key: 'theme', value: 'light', description: '主题模式' },
      { key: 'auto_backup', value: 'false', description: '是否自动备份' },
      { key: 'last_backup', value: '', description: '上次备份时间' },
    ];

    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)'
    );
    const tx = this.db.transaction((items) => {
      for (const item of items) {
        stmt.run(item.key, item.value, item.description);
      }
    });
    tx(defaults);
  }

  getDbPath(): string {
    return this.dbPath;
  }

  getConnection(): Database.Database {
    if (!this.db) {
      this.init();
    }
    return this.db as Database.Database;
  }

  insert<T extends Record<string, any>>(table: TableName, data: T): number {
    if (!this.db) this.init();
    const keys = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const sql = `INSERT INTO ${table} (${keys}) VALUES (${placeholders})`;
    const result = (this.db as Database.Database).prepare(sql).run(...values);
    return Number(result.lastInsertRowid);
  }

  update<T extends Record<string, any>>(
    table: TableName,
    id: number,
    data: Partial<T>
  ): boolean {
    if (!this.db) this.init();
    const updates = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(data), id];

    const sql = `UPDATE ${table} SET ${updates} WHERE id = ?`;
    const result = (this.db as Database.Database).prepare(sql).run(...values);
    return result.changes > 0;
  }

  delete(table: TableName, id: number): boolean {
    if (!this.db) this.init();
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    const result = (this.db as Database.Database).prepare(sql).run(id);
    return result.changes > 0;
  }

  deleteWhere(
    table: TableName,
    where: Record<string, any>
  ): number {
    if (!this.db) this.init();
    const conditions = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(where);

    const sql = `DELETE FROM ${table} WHERE ${conditions}`;
    const result = (this.db as Database.Database).prepare(sql).run(...values);
    return result.changes;
  }

  findById<T>(table: TableName, id: number): T | null {
    if (!this.db) this.init();
    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    const row = (this.db as Database.Database).prepare(sql).get(id);
    return (row as T) || null;
  }

  findAll<T>(table: TableName, options?: QueryOptions): T[] {
    if (!this.db) this.init();
    let sql = `SELECT * FROM ${table}`;
    const params: any[] = [];

    if (options?.where && Object.keys(options.where).length > 0) {
      const conditions = Object.keys(options.where)
        .map((key) => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${conditions}`;
      params.push(...Object.values(options.where));
    }

    if (options?.orderBy) {
      const direction = options.orderDirection || 'DESC';
      sql += ` ORDER BY ${options.orderBy} ${direction}`;
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options?.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }

    const rows = (this.db as Database.Database).prepare(sql).all(...params);
    return rows as T[];
  }

  findOne<T>(table: TableName, options?: QueryOptions): T | null {
    const results = this.findAll<T>(table, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  count(table: TableName, where?: Record<string, any>): number {
    if (!this.db) this.init();
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.keys(where)
        .map((key) => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${conditions}`;
      params.push(...Object.values(where));
    }

    const row = (this.db as Database.Database).prepare(sql).get(...params) as {
      count: number;
    };
    return row.count;
  }

  customQuery<T>(sql: string, params?: any[]): T[] {
    if (!this.db) this.init();
    const rows = (this.db as Database.Database).prepare(sql).all(...(params || []));
    return rows as T[];
  }

  customExecute(sql: string, params?: any[]): { changes: number; lastInsertRowid: number } {
    if (!this.db) this.init();
    const result = (this.db as Database.Database)
      .prepare(sql)
      .run(...(params || []));
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  transaction<T>(callback: (db: Database.Database) => T): T {
    if (!this.db) this.init();
    const transaction = (this.db as Database.Database).transaction(callback);
    return transaction(this.db as Database.Database);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const databaseManager = new DatabaseManager();
export default DatabaseManager;
