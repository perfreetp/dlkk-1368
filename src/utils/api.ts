interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type TableName =
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

interface QueryOptions {
  where?: Record<string, any>;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

interface ImportPhotoResult {
  success: boolean;
  file_path?: string;
  file_name?: string;
  file_hash?: string;
  file_size?: number;
  isDuplicate?: boolean;
  error?: string;
}

interface BackupOptions {
  includePhotos?: boolean;
  includeSafeFiles?: boolean;
  backupName?: string;
}

interface BackupResult {
  success: boolean;
  backupPath?: string;
  fileSize?: number;
  error?: string;
}

interface BackupInfo {
  name: string;
  path: string;
  size: number;
  created: Date;
}

const TABLE_PREFIX = 'tbl_';
const ID_COUNTER_PREFIX = 'id_counter_';

const KNOWN_TABLES: TableName[] = [
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

function getTableKey(table: string): string {
  return `${TABLE_PREFIX}${table}`;
}

function getIdCounterKey(table: string): string {
  return `${ID_COUNTER_PREFIX}${table}`;
}

function getMockTable<T = any>(table: string): T[] {
  const key = getTableKey(table);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMockTable(table: string, data: any[]): void {
  const key = getTableKey(table);
  localStorage.setItem(key, JSON.stringify(data));
}

function getNextId(table: string): number {
  const counterKey = getIdCounterKey(table);
  const current = parseInt(localStorage.getItem(counterKey) || '0', 10);
  const next = current + 1;
  localStorage.setItem(counterKey, String(next));
  return next;
}

function parseWhereClause(whereStr: string): { conditions: Array<{ field: string; operator: string; value: any }>; logicalOps: string[] } {
  const conditions: Array<{ field: string; operator: string; value: any }> = [];
  const logicalOps: string[] = [];

  if (!whereStr) return { conditions, logicalOps };

  const tokens = whereStr.split(/\s+(AND|OR)\s+/i);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (i % 2 === 1) {
      logicalOps.push(token.toUpperCase());
    } else {
      const match = token.match(/^(\w+)\s*(=|<>|!=|>|<|>=|<=|LIKE|IN)\s*(.+)$/i);
      if (match) {
        conditions.push({
          field: match[1],
          operator: match[2].toUpperCase(),
          value: match[3].replace(/^['"]|['"]$/g, ''),
        });
      }
    }
  }

  return { conditions, logicalOps };
}

function applyParamsToSql(sql: string, params: any[] = []): string {
  let result = sql;
  let paramIndex = 0;
  result = result.replace(/\?/g, () => {
    const val = params[paramIndex++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    return String(val);
  });
  return result;
}

function matchCondition(row: any, field: string, operator: string, value: any): boolean {
  const rowVal = row[field];
  switch (operator) {
    case '=':
      return String(rowVal) === String(value);
    case '<>':
    case '!=':
      return String(rowVal) !== String(value);
    case '>':
      return Number(rowVal) > Number(value);
    case '<':
      return Number(rowVal) < Number(value);
    case '>=':
      return Number(rowVal) >= Number(value);
    case '<=':
      return Number(rowVal) <= Number(value);
    case 'LIKE': {
      const pattern = String(value).replace(/%/g, '.*').replace(/_/g, '.');
      return new RegExp(`^${pattern}$`, 'i').test(String(rowVal || ''));
    }
    default:
      return false;
  }
}

function evaluateWhere(row: any, whereClause: string, params: any[] = []): boolean {
  const whereWithParams = applyParamsToSql(whereClause, params);
  const { conditions, logicalOps } = parseWhereClause(whereWithParams);

  if (conditions.length === 0) return true;

  let result = matchCondition(row, conditions[0].field, conditions[0].operator, conditions[0].value);

  for (let i = 0; i < logicalOps.length; i++) {
    const nextResult = matchCondition(
      row,
      conditions[i + 1].field,
      conditions[i + 1].operator,
      conditions[i + 1].value
    );
    if (logicalOps[i] === 'AND') {
      result = result && nextResult;
    } else {
      result = result || nextResult;
    }
  }

  return result;
}

function parseSelect(sql: string): {
  table: string;
  fields: string[];
  whereClause: string;
  orderBy: string | null;
  orderDirection: 'ASC' | 'DESC';
  limit: number | null;
} {
  const normalized = sql.replace(/\s+/g, ' ').trim();

  const selectMatch = normalized.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)/i);
  if (!selectMatch) return { table: '', fields: ['*'], whereClause: '', orderBy: null, orderDirection: 'DESC', limit: null };

  const fieldsStr = selectMatch[1].trim();
  const table = selectMatch[2].trim();
  const fields = fieldsStr === '*' ? ['*'] : fieldsStr.split(',').map((f) => f.trim());

  let rest = normalized.substring(selectMatch[0].length).trim();

  let whereClause = '';
  const whereMatch = rest.match(/^WHERE\s+(.+?)(?=\s+ORDER\s+BY|\s+LIMIT|$)/i);
  if (whereMatch) {
    whereClause = whereMatch[1].trim();
    rest = rest.substring(whereMatch[0].length).trim();
  }

  let orderBy: string | null = null;
  let orderDirection: 'ASC' | 'DESC' = 'DESC';
  const orderMatch = rest.match(/^ORDER\s+BY\s+(.+?)(?=\s+LIMIT|$)/i);
  if (orderMatch) {
    const orderParts = orderMatch[1].trim().split(/\s+/);
    orderBy = orderParts[0];
    if (orderParts.length > 1) {
      orderDirection = orderParts[1].toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    }
    rest = rest.substring(orderMatch[0].length).trim();
  }

  let limit: number | null = null;
  const limitMatch = rest.match(/^LIMIT\s+(\d+)/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1], 10);
  }

  return { table, fields, whereClause, orderBy, orderDirection, limit };
}

function executeMockSelect(sql: string, params: any[] = []): any[] {
  const { table, fields, whereClause, orderBy, orderDirection, limit } = parseSelect(sql);

  if (!table) return [];

  if (KNOWN_TABLES.indexOf(table as TableName) === -1) {
    if (!localStorage.getItem(getTableKey(table))) {
      saveMockTable(table, []);
    }
  }

  let data = getMockTable(table);

  if (whereClause) {
    data = data.filter((row) => evaluateWhere(row, whereClause, params));
  }

  if (orderBy) {
    data.sort((a, b) => {
      const valA = a[orderBy];
      const valB = b[orderBy];
      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA || '').localeCompare(String(valB || ''));
      }
      return orderDirection === 'ASC' ? cmp : -cmp;
    });
  }

  if (limit !== null) {
    data = data.slice(0, limit);
  }

  if (fields.length === 1 && fields[0] === '*') {
    return data;
  }

  const isCountAggregate = fields.some((f) => /COUNT\(/i.test(f));
  if (isCountAggregate) {
    return [{ count: data.length }];
  }

  return data.map((row) => {
    const result: any = {};
    for (const field of fields) {
      const cleanField = field.replace(/\s+AS\s+\w+$/i, '').trim();
      result[cleanField] = row[cleanField];
    }
    return result;
  });
}

function parseInsert(sql: string): { table: string; columns: string[]; values: any[] } {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!match) return { table: '', columns: [], values: [] };

  const table = match[1].trim();
  const columns = match[2].split(',').map((c) => c.trim());
  const valuesStr = match[3];

  const values: any[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < valuesStr.length; i++) {
    const ch = valuesStr[i];
    if (ch === "'" && valuesStr[i - 1] !== "\\") {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      const val = current.trim();
      if (val === 'NULL' || val === '') values.push(null);
      else if (val.startsWith("'") && val.endsWith("'")) values.push(val.slice(1, -1));
      else if (!isNaN(Number(val))) values.push(Number(val));
      else values.push(val);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) {
    const val = current.trim();
    if (val === 'NULL' || val === '') values.push(null);
    else if (val.startsWith("'") && val.endsWith("'")) values.push(val.slice(1, -1));
    else if (!isNaN(Number(val))) values.push(Number(val));
    else values.push(val);
  }

  return { table, columns, values };
}

function executeMockInsert(sql: string, params: any[] = []): { lastID: number; changes: number } {
  const { table, columns, values: rawValues } = parseInsert(sql);
  if (!table) return { lastID: 0, changes: 0 };

  const values = rawValues.map((v, i) => {
    if (typeof v === 'string' && v === '?') {
      return params[i];
    }
    return v;
  });

  if (KNOWN_TABLES.indexOf(table as TableName) === -1) {
    if (!localStorage.getItem(getTableKey(table))) {
      saveMockTable(table, []);
    }
  }

  const data = getMockTable(table);
  const newRow: any = {};

  for (let i = 0; i < columns.length; i++) {
    newRow[columns[i]] = values[i];
  }

  const newId = getNextId(table);
  newRow.id = newId;

  if (!newRow.created_at) {
    newRow.created_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
  }
  if (!newRow.updated_at && columns.indexOf('updated_at') === -1) {
    newRow.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  data.push(newRow);
  saveMockTable(table, data);

  return { lastID: newId, changes: 1 };
}

function parseUpdate(sql: string): { table: string; sets: Array<{ column: string; value: any }>; whereClause: string } {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
  if (!match) return { table: '', sets: [], whereClause: '' };

  const table = match[1].trim();
  const setsStr = match[2].trim();
  const whereClause = match[3] ? match[3].trim() : '';

  const sets: Array<{ column: string; value: any }> = [];
  const setParts = setsStr.split(/,(?![^()]*\))/);

  for (const part of setParts) {
    const setMatch = part.trim().match(/^(\w+)\s*=\s*(.+)$/);
    if (setMatch) {
      let val = setMatch[2].trim();
      if (val === '?') {
        sets.push({ column: setMatch[1], value: '?' });
      } else if (val.startsWith("'") && val.endsWith("'")) {
        sets.push({ column: setMatch[1], value: val.slice(1, -1) });
      } else if (val.toUpperCase().startsWith('DATETIME(')) {
        sets.push({ column: setMatch[1], value: new Date().toISOString().replace('T', ' ').substring(0, 19) });
      } else if (!isNaN(Number(val))) {
        sets.push({ column: setMatch[1], value: Number(val) });
      } else {
        sets.push({ column: setMatch[1], value: val });
      }
    }
  }

  return { table, sets, whereClause };
}

function executeMockUpdate(sql: string, params: any[] = []): { lastID: number; changes: number } {
  const { table, sets, whereClause } = parseUpdate(sql);
  if (!table) return { lastID: 0, changes: 0 };

  if (KNOWN_TABLES.indexOf(table as TableName) === -1) {
    if (!localStorage.getItem(getTableKey(table))) {
      saveMockTable(table, []);
    }
  }

  const data = getMockTable(table);
  let changes = 0;
  let lastID = 0;

  let paramIndex = 0;
  const resolvedSets = sets.map((s) => {
    if (s.value === '?') {
      return { column: s.column, value: params[paramIndex++] };
    }
    return s;
  });

  const remainingParams = params.slice(paramIndex);

  for (let i = 0; i < data.length; i++) {
    if (!whereClause || evaluateWhere(data[i], whereClause, remainingParams)) {
      for (const set of resolvedSets) {
        data[i][set.column] = set.value;
      }
      if (table !== 'settings' && !sets.find((s) => s.column === 'updated_at')) {
        data[i].updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      }
      lastID = data[i].id || lastID;
      changes++;
    }
  }

  saveMockTable(table, data);
  return { lastID, changes };
}

function parseDelete(sql: string): { table: string; whereClause: string } {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
  if (!match) return { table: '', whereClause: '' };

  return {
    table: match[1].trim(),
    whereClause: match[2] ? match[2].trim() : '',
  };
}

function executeMockDelete(sql: string, params: any[] = []): { lastID: number; changes: number } {
  const { table, whereClause } = parseDelete(sql);
  if (!table) return { lastID: 0, changes: 0 };

  const data = getMockTable(table);
  const newData: any[] = [];
  let changes = 0;

  for (const row of data) {
    if (!whereClause || evaluateWhere(row, whereClause, params)) {
      changes++;
    } else {
      newData.push(row);
    }
  }

  saveMockTable(table, newData);
  return { lastID: 0, changes };
}

export async function dbAll<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const api = window.electronAPI;

  if (api?.database?.customQuery) {
    const resp = await api.database.customQuery<T>(sql, params);
    if (resp.success) return resp.data || [];
    throw new Error(resp.error || '数据库查询失败');
  }

  if (api?.database?.all) {
    return api.database.all(sql, params) as Promise<T[]>;
  }

  return executeMockSelect(sql, params || []) as T[];
}

export async function dbGet<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await dbAll<T>(sql, params);
  return results[0] || null;
}

export async function dbRun(
  sql: string,
  params?: any[]
): Promise<{ lastID: number; changes: number }> {
  const api = window.electronAPI;
  const upperSql = sql.trim().toUpperCase();

  if (api?.database?.customExecute) {
    const resp = await api.database.customExecute(sql, params);
    if (resp.success) {
      return {
        lastID: resp.data?.lastInsertRowid || 0,
        changes: resp.data?.changes || 0,
      };
    }
    throw new Error(resp.error || '数据库执行失败');
  }

  if (api?.database?.run) {
    return api.database.run(sql, params);
  }

  if (upperSql.startsWith('INSERT')) {
    return executeMockInsert(sql, params || []);
  } else if (upperSql.startsWith('UPDATE')) {
    return executeMockUpdate(sql, params || []);
  } else if (upperSql.startsWith('DELETE')) {
    return executeMockDelete(sql, params || []);
  }

  return { lastID: 0, changes: 0 };
}

export async function dbInsert(table: string, data: Record<string, any>): Promise<number> {
  const api = window.electronAPI;

  if (api?.database?.insert) {
    const resp = await api.database.insert(table as TableName, data);
    if (resp.success) return resp.data || 0;
    throw new Error(resp.error || '插入失败');
  }

  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const result = await dbRun(sql, values);
  return result.lastID;
}

export async function dbUpdate(
  table: string,
  id: number | string,
  data: Record<string, any>
): Promise<boolean> {
  const api = window.electronAPI;

  if (api?.database?.update) {
    const resp = await api.database.update(table as TableName, Number(id), data);
    if (resp.success) return resp.data || false;
    throw new Error(resp.error || '更新失败');
  }

  const sets = Object.keys(data).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  const sql = `UPDATE ${table} SET ${sets} WHERE id = ?`;
  const result = await dbRun(sql, values);
  return result.changes > 0;
}

export async function dbDelete(table: string, id: number | string): Promise<boolean> {
  const api = window.electronAPI;

  if (api?.database?.delete) {
    const resp = await api.database.delete(table as TableName, Number(id));
    if (resp.success) return resp.data || false;
    throw new Error(resp.error || '删除失败');
  }

  const sql = `DELETE FROM ${table} WHERE id = ?`;
  const result = await dbRun(sql, [id]);
  return result.changes > 0;
}

export async function encryptData(data: string, password: string): Promise<string> {
  const api = window.electronAPI;

  if (api?.crypto?.simpleEncrypt) {
    const resp = await api.crypto.simpleEncrypt(data, password);
    if (resp.success && resp.data) return resp.data;
    if (resp.error) throw new Error(resp.error);
  }

  if (api?.encrypt) {
    return api.encrypt(data, password);
  }

  let result = '';
  const pwdLen = password.length;
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ password.charCodeAt(i % pwdLen));
  }
  return btoa(encodeURIComponent(unescape(result)));
}

export async function decryptData(encrypted: string, password: string): Promise<string> {
  const api = window.electronAPI;

  if (api?.crypto?.simpleDecrypt) {
    const resp = await api.crypto.simpleDecrypt(encrypted, password);
    if (resp.success && resp.data !== undefined) return resp.data;
    if (resp.error) throw new Error(resp.error);
  }

  if (api?.decrypt) {
    return api.decrypt(encrypted, password);
  }

  try {
    const decoded = escape(decodeURIComponent(atob(encrypted)));
    let result = '';
    const pwdLen = password.length;
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ password.charCodeAt(i % pwdLen));
    }
    return result;
  } catch {
    throw new Error('解密失败，密码错误或数据损坏');
  }
}

export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string }> {
  const api = window.electronAPI;

  if (api?.crypto?.hashPassword) {
    const resp = await api.crypto.hashPassword(password);
    if (resp.success && resp.data) return resp.data;
    if (resp.error) throw new Error(resp.error);
  }

  if (api?.hashPassword) {
    return api.hashPassword(password);
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

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  const api = window.electronAPI;

  if (api?.crypto?.verifyPassword) {
    const resp = await api.crypto.verifyPassword(password, hash, salt);
    if (resp.success) return resp.data || false;
    if (resp.error) throw new Error(resp.error);
  }

  if (api?.verifyPassword) {
    return api.verifyPassword(password, hash, salt);
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
  const api = window.electronAPI;

  if (api?.saveFile) {
    return api.saveFile(content, filename);
  }

  localStorage.setItem(`file_${filename}`, content);
  return filename;
}

export async function readFile(filepath: string): Promise<string> {
  const api = window.electronAPI;

  if (api?.readFile) {
    return api.readFile(filepath);
  }

  const content = localStorage.getItem(`file_${filepath}`);
  if (content === null) {
    throw new Error('文件不存在');
  }
  return content;
}

export async function deleteFile(filepath: string): Promise<boolean> {
  const api = window.electronAPI;

  if (api?.file?.delete) {
    const resp = await api.file.delete(filepath);
    if (resp.success) return resp.data || false;
  }

  if (api?.deleteFile) {
    return api.deleteFile(filepath);
  }

  localStorage.removeItem(`file_${filepath}`);
  return true;
}

type ShowMessageType = 'info' | 'warning' | 'error' | 'question' | 'success';
interface ShowMessageOptions {
  type: ShowMessageType;
  title: string;
  message: string;
}

export async function showMessage(
  typeOrOptions: ShowMessageType | ShowMessageOptions,
  titleOrMessage?: string,
  message?: string
): Promise<void> {
  let options: ShowMessageOptions;

  if (typeof typeOrOptions === 'string') {
    options = {
      type: typeOrOptions,
      title: titleOrMessage || '',
      message: message || titleOrMessage || '',
    };
  } else {
    options = typeOrOptions;
  }

  const api = window.electronAPI;
  const internalType = options.type === 'success' ? 'info' : (options.type as any);

  if (api?.dialog?.showMessageBox) {
    await api.dialog.showMessageBox({
      type: internalType,
      title: options.title,
      message: options.message,
    });
    return;
  }

  if (api?.showMessage) {
    return api.showMessage({
      type: internalType,
      title: options.title,
      message: options.message,
    });
  }

  const prefix =
    options.type === 'error' ? '❌ ' :
    options.type === 'warning' ? '⚠️ ' :
    options.type === 'question' ? '❓ ' :
    options.type === 'success' ? '✅ ' : 'ℹ️ ';
  alert(`${prefix}${options.title}\n\n${options.message}`);
}

export async function selectFile(
  filters?: { name: string; extensions: string[] }[]
): Promise<string | null> {
  const api = window.electronAPI;

  if (api?.dialog?.openFile) {
    const fileFilters = filters?.map((f) => ({
      name: f.name,
      extensions: f.extensions,
    }));
    const resp = await api.dialog.openFile({
      filters: fileFilters,
      properties: ['openFile'],
    });
    if (resp.success && resp.data?.filePaths?.length > 0) {
      return resp.data.filePaths[0];
    }
    return null;
  }

  if (api?.selectFile) {
    return api.selectFile(filters);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (filters) {
      input.accept = filters
        .map((f) => f.extensions.map((ext) => `.${ext}`).join(','))
        .join(',');
    }
    input.onchange = () => {
      if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          const filePath = `browser_file_${Date.now()}_${file.name}`;
          const content = reader.result as string;
          localStorage.setItem(`file_${filePath}`, content);
          resolve(filePath);
        };
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

export async function selectPhotoFiles(): Promise<string[]> {
  const api = window.electronAPI;
  const photoFilters = [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }];

  if (api?.dialog?.openFile) {
    const resp = await api.dialog.openFile({
      filters: photoFilters,
      properties: ['openFile', 'multiSelections'],
    });
    if (resp.success && resp.data?.filePaths?.length > 0) {
      return resp.data.filePaths;
    }
    return [];
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = photoFilters
      .map((f) => f.extensions.map((ext) => `.${ext}`).join(','))
      .join(',');
    input.onchange = async () => {
      const paths: string[] = [];
      if (input.files) {
        for (let i = 0; i < input.files.length; i++) {
          const file = input.files[i];
          const filePath = `browser_file_${Date.now()}_${i}_${file.name}`;
          const content = await new Promise<string>((res) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.readAsDataURL(file);
          });
          localStorage.setItem(`file_${filePath}`, content);
          paths.push(filePath);
        }
      }
      resolve(paths);
    };
    input.click();
  });
}

export async function selectSaveFile(defaultPath?: string): Promise<string | null> {
  const api = window.electronAPI;

  if (api?.dialog?.saveFile) {
    const resp = await api.dialog.saveFile({ defaultPath });
    if (resp.success && resp.data?.filePath) {
      return resp.data.filePath;
    }
    return null;
  }

  if (api?.selectSaveFile) {
    return api.selectSaveFile(defaultPath);
  }

  return defaultPath || `file_${Date.now()}`;
}

export async function importPhoto(
  filePath: string,
  existingHashes: string[]
): Promise<ImportPhotoResult> {
  const api = window.electronAPI;

  if (api?.file?.importPhoto) {
    const resp = await api.file.importPhoto(filePath, existingHashes);
    if (resp.success && resp.data) return resp.data;
    if (resp.error) return { success: false, error: resp.error };
  }

  const fileHash = `browser_hash_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  if (existingHashes.includes(fileHash)) {
    return {
      success: false,
      isDuplicate: true,
      file_hash: fileHash,
      error: '文件已存在',
    };
  }

  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || `photo_${Date.now()}`;

  return {
    success: true,
    file_path: filePath,
    file_name: fileName,
    file_hash: fileHash,
    file_size: 0,
  };
}

export async function readFileAsBase64(filePath: string): Promise<string | null> {
  const api = window.electronAPI;

  if (api?.file?.readAsBase64) {
    const resp = await api.file.readAsBase64(filePath);
    if (resp.success) return resp.data || null;
    if (resp.error) return null;
  }

  try {
    const content = localStorage.getItem(`file_${filePath}`);
    if (content && content.startsWith('data:')) {
      const base64Part = content.split(',')[1];
      return base64Part || null;
    }
    if (content) {
      return btoa(unescape(encodeURIComponent(content)));
    }
    return null;
  } catch {
    return null;
  }
}

export async function backupCreate(
  options?: BackupOptions
): Promise<BackupResult> {
  const api = window.electronAPI;

  if (api?.backup?.create) {
    const resp = await api.backup.create(options);
    if (resp.success && resp.data) return resp.data;
    if (resp.error) return { success: false, error: resp.error };
  }

  if (api?.backup?.createBackup) {
    const result = await api.backup.createBackup(options || {});
    return {
      success: result.success,
      backupPath: result.filePath,
      error: result.error,
    };
  }

  const mockBackup: Record<string, any> = {
    createdAt: new Date().toISOString(),
    tables: {},
  };

  for (const table of KNOWN_TABLES) {
    const data = getMockTable(table);
    if (data.length > 0) {
      mockBackup.tables[table] = data;
    }
  }

  const backupKey = `backup_${Date.now()}`;
  localStorage.setItem(backupKey, JSON.stringify(mockBackup));

  const backupMetaKey = 'backups_meta';
  const metaRaw = localStorage.getItem(backupMetaKey);
  const meta = metaRaw ? JSON.parse(metaRaw) : [];
  meta.push({
    key: backupKey,
    name: options?.backupName || `backup_${Date.now()}`,
    createdAt: mockBackup.createdAt,
    size: JSON.stringify(mockBackup).length,
  });
  localStorage.setItem(backupMetaKey, JSON.stringify(meta));

  return {
    success: true,
    backupPath: backupKey,
    fileSize: JSON.stringify(mockBackup).length,
  };
}

export async function backupRestore(
  backupPath: string,
  overwrite: boolean = true
): Promise<boolean> {
  const api = window.electronAPI;

  if (api?.backup?.restore) {
    const resp = await api.backup.restore(backupPath, overwrite);
    if (resp.success) return resp.data || false;
  }

  if (api?.backup?.restoreBackup) {
    const result = await api.backup.restoreBackup({ backupId: backupPath, backupPath });
    return result.success;
  }

  try {
    const raw = localStorage.getItem(backupPath);
    if (!raw) return false;

    const backup = JSON.parse(raw);
    if (!backup.tables) return false;

    for (const table of Object.keys(backup.tables)) {
      const data = backup.tables[table];
      if (overwrite) {
        saveMockTable(table, data);
        const maxId = data.reduce((max: number, row: any) => Math.max(max, row.id || 0), 0);
        if (maxId > 0) {
          localStorage.setItem(getIdCounterKey(table), String(maxId));
        }
      } else {
        const existing = getMockTable(table);
        const existingIds = new Set(existing.map((r: any) => r.id));
        for (const row of data) {
          if (!existingIds.has(row.id)) {
            existing.push(row);
          }
        }
        saveMockTable(table, existing);
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function backupList(): Promise<BackupInfo[]> {
  const api = window.electronAPI;

  if (api?.backup?.list) {
    const resp = await api.backup.list();
    if (resp.success && resp.data) {
      return (resp.data as any[]).map((b: any) => ({
        name: b.name || b.backup_name || '',
        path: b.path || b.filePath || b.file_path || '',
        size: b.size || b.fileSize || b.file_size || 0,
        created: b.created ? new Date(b.created) : new Date(b.createdAt || b.created_at || Date.now()),
      }));
    }
  }

  if (api?.backup?.listBackups) {
    const data = await api.backup.listBackups();
    return data.map((b: any) => ({
      name: b.name || b.backup_name || '',
      path: b.path || b.filePath || b.file_path || '',
      size: b.size || b.fileSize || b.file_size || 0,
      created: b.created ? new Date(b.created) : new Date(b.createdAt || b.created_at || Date.now()),
    }));
  }

  const metaRaw = localStorage.getItem('backups_meta');
  if (!metaRaw) return [];

  try {
    const meta = JSON.parse(metaRaw);
    return meta
      .map((m: any) => ({
        name: m.name,
        path: m.key,
        size: m.size || 0,
        created: new Date(m.createdAt || Date.now()),
      }))
      .sort((a: BackupInfo, b: BackupInfo) => b.created.getTime() - a.created.getTime());
  } catch {
    return [];
  }
}

export async function backupDelete(backupPath: string): Promise<boolean> {
  const api = window.electronAPI;

  if (api?.backup?.delete) {
    const resp = await api.backup.delete(backupPath);
    if (resp.success) return resp.data || false;
  }

  localStorage.removeItem(backupPath);

  const metaRaw = localStorage.getItem('backups_meta');
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw).filter((m: any) => m.key !== backupPath && m.path !== backupPath);
      localStorage.setItem('backups_meta', JSON.stringify(meta));
    } catch {
      // ignore
    }
  }

  return true;
}
