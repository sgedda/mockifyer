import path from 'path';
import fs from 'fs';
import type { DashboardContextConfig } from './dashboard-context';
import { RedisMockStore, type RedisMockStoreConfig } from './redis-mock-store';
import { isCentralizedDashboardProvider } from './dashboard-provider';

/**
 * Resolve SQLite DB path for dashboard `--provider sqlite`.
 * Uses explicit `.db` path, `MOCKIFYER_DB_PATH`, or `<mockDataPath>/mockifyer-dashboard.db`.
 */
export function resolveDashboardSqlitePath(mockDataPath: string, config: DashboardContextConfig): string {
  if (mockDataPath.endsWith('.db')) {
    return path.resolve(mockDataPath);
  }
  const fromEnv = process.env.MOCKIFYER_DB_PATH?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.resolve(mockDataPath, 'mockifyer-dashboard.db');
}

function ensureDashboardSqliteDirectory(sqlitePath: string): void {
  const sqliteDir = path.dirname(sqlitePath);
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }
}

export function createDashboardMockStore(
  config: DashboardContextConfig,
  mockDataPath: string
): RedisMockStore {
  if (!isCentralizedDashboardProvider(config.provider)) {
    throw new Error(`createDashboardMockStore requires redis or sqlite provider, got: ${config.provider}`);
  }

  const base: RedisMockStoreConfig = {
    mockDataPath,
    keyPrefix: config.keyPrefix,
  };

  if (config.provider === 'sqlite') {
    const sqlitePath = resolveDashboardSqlitePath(mockDataPath, config);
    ensureDashboardSqliteDirectory(sqlitePath);
    return new RedisMockStore({
      ...base,
      sqlitePath,
    });
  }

  return new RedisMockStore({
    ...base,
    redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
  });
}
