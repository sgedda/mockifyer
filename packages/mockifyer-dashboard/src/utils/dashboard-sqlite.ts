import fs from 'fs';
import path from 'path';
import type { DashboardContextConfig } from './dashboard-context';

const DASHBOARD_SQLITE_FILENAME = 'mockifyer-dashboard.db';
const SQLITE_BUSY_TIMEOUT_MS = 5_000;

/**
 * Resolve SQLite DB path for dashboard `--provider sqlite`.
 * Uses explicit `.db` path, `MOCKIFYER_DB_PATH`, or `<mockDataPath>/mockifyer-dashboard.db`.
 */
export function resolveDashboardSqlitePath(mockDataPath: string, _config: DashboardContextConfig): string {
  if (mockDataPath.endsWith('.db')) {
    return path.resolve(mockDataPath);
  }
  const fromEnv = process.env.MOCKIFYER_DB_PATH?.trim();
  if (fromEnv) {
    const resolved = path.resolve(fromEnv);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return path.join(resolved, DASHBOARD_SQLITE_FILENAME);
    }
    return resolved;
  }
  return path.resolve(mockDataPath, DASHBOARD_SQLITE_FILENAME);
}

export function ensureSqliteDatabaseDirectory(dbPath: string): void {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
}

export function configureDashboardSqliteDatabase(db: { pragma: (statement: string) => unknown }): void {
  db.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  db.pragma('journal_mode = WAL');
}
