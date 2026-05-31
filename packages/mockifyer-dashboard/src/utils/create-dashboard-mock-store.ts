import type { DashboardContextConfig } from './dashboard-context';
import { RedisMockStore, type RedisMockStoreConfig } from './redis-mock-store';
import { isCentralizedDashboardProvider } from './dashboard-provider';
import { resolveDashboardSqlitePath } from './dashboard-sqlite';

export { resolveDashboardSqlitePath } from './dashboard-sqlite';

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
    return new RedisMockStore({
      ...base,
      sqlitePath: resolveDashboardSqlitePath(mockDataPath, config),
    });
  }

  return new RedisMockStore({
    ...base,
    redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
  });
}
