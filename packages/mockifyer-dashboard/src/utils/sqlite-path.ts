import fs from 'fs';
import path from 'path';
import type { DashboardContextConfig } from './dashboard-context';

/**
 * Resolve SQLite DB path for dashboard `--provider sqlite`.
 * Uses explicit `.db` path, `MOCKIFYER_DB_PATH`, or `<mockDataPath>/mockifyer-dashboard.db`.
 */
export function resolveDashboardSqlitePath(mockDataPath: string, config: DashboardContextConfig): string {
  const explicit = config.sqlitePath?.trim();
  if (explicit) {
    return path.resolve(explicit);
  }

  if (mockDataPath.endsWith('.db')) {
    return path.resolve(mockDataPath);
  }

  const fromEnv = process.env.MOCKIFYER_DB_PATH?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  return path.resolve(mockDataPath, 'mockifyer-dashboard.db');
}

/**
 * Filesystem helpers still need a directory root even when the SQLite DB is an explicit file path.
 */
export function resolveDashboardDataRoot(mockDataPath: string): string {
  if (mockDataPath.endsWith('.db')) {
    return path.dirname(path.resolve(mockDataPath));
  }

  return mockDataPath;
}

export function ensureSqliteDatabaseDirectory(dbPath: string): void {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
}
