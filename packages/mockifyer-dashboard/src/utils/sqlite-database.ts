import fs from 'fs';
import path from 'path';

const SQLITE_BUSY_TIMEOUT_MS = 5_000;

function requireBetterSqlite3(errorMessage: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(/* webpackIgnore: true */ 'better-sqlite3');
  } catch {
    throw new Error(errorMessage);
  }
}

export function ensureDashboardSqliteParentDir(dbPath: string): void {
  if (dbPath === ':memory:') return;
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
}

export function openDashboardSqliteDatabase(dbPath: string, errorMessage: string): any {
  const Database = requireBetterSqlite3(errorMessage);
  ensureDashboardSqliteParentDir(dbPath);
  const db = new Database(dbPath, { timeout: SQLITE_BUSY_TIMEOUT_MS });
  db.pragma('journal_mode = WAL');
  db.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  return db;
}
