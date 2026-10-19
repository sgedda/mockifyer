import path from 'path';
import type { DashboardContextConfig } from './dashboard-context';
import { RedisMockStore, type RedisMockStoreConfig } from './redis-mock-store';
import { isCentralizedDashboardProvider } from './dashboard-provider';
import { createSharedStoreCache } from './shared-store-cache';

export type DashboardRedisConfig = Pick<
  DashboardContextConfig,
  'provider' | 'redisUrl' | 'keyPrefix' | 'redisCluster'
>;

/** Redis client options for ioredis / cluster auto-detect from dashboard config. */
export function buildDashboardRedisClientOptions(
  config: Pick<DashboardContextConfig, 'redisCluster'>
): Record<string, unknown> | undefined {
  if (config.redisCluster === true) return { cluster: true };
  if (config.redisCluster === false) return { cluster: false };
  return undefined;
}

/** Minimal config slice for centralized mock store / Redis KV access. */
export function toDashboardRedisStoreConfig(config: DashboardRedisConfig): DashboardRedisConfig {
  return {
    provider: config.provider,
    redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL,
    keyPrefix: config.keyPrefix,
    redisCluster: config.redisCluster,
  };
}

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

const dashboardMockStoreCache = createSharedStoreCache<RedisMockStore>();

/** Stable cache key so /api/mocks does not open a new Redis/SQLite client per request. */
export function dashboardMockStoreCacheKey(
  config: DashboardContextConfig,
  mockDataPath: string
): string {
  if (config.provider === 'sqlite') {
    return `sqlite:${resolveDashboardSqlitePath(mockDataPath, config)}:${config.keyPrefix || ''}`;
  }
  const redisUrl = config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '';
  const cluster =
    config.redisCluster === true ? '1' : config.redisCluster === false ? '0' : 'auto';
  return `redis:${redisUrl}:${cluster}:${config.keyPrefix || ''}:${path.resolve(mockDataPath)}`;
}

function instantiateDashboardMockStore(
  config: DashboardContextConfig,
  mockDataPath: string
): RedisMockStore {
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

  const redisOptions = buildDashboardRedisClientOptions(config);

  return new RedisMockStore({
    ...base,
    redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
    ...(redisOptions ? { redisOptions } : {}),
  });
}

/**
 * Process-wide mock store. Route `close()` is a no-op so request handlers can keep
 * calling it without tearing down the shared Redis/SQLite connection.
 */
export function createDashboardMockStore(
  config: DashboardContextConfig,
  mockDataPath: string
): RedisMockStore {
  if (!isCentralizedDashboardProvider(config.provider)) {
    throw new Error(`createDashboardMockStore requires redis or sqlite provider, got: ${config.provider}`);
  }

  return dashboardMockStoreCache.getOrCreate(dashboardMockStoreCacheKey(config, mockDataPath), () =>
    instantiateDashboardMockStore(config, mockDataPath)
  );
}

/** Close cached stores (tests / process shutdown). */
export async function closeCachedDashboardMockStores(): Promise<void> {
  await dashboardMockStoreCache.closeAll();
}
