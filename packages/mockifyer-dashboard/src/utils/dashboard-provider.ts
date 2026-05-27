import type { DashboardContextConfig } from './dashboard-context';

/** Dashboard backends that use {@link RedisMockStore} (Redis or SQLite KV). */
export type CentralizedDashboardProvider = 'redis' | 'sqlite';

export function isCentralizedDashboardProvider(
  provider: DashboardContextConfig['provider']
): provider is CentralizedDashboardProvider {
  return provider === 'redis' || provider === 'sqlite';
}

/** Supports `/api/proxy`, client lanes, and persistent network log (when sqlite/redis is healthy). */
export function supportsDashboardProxy(provider: DashboardContextConfig['provider']): boolean {
  return isCentralizedDashboardProvider(provider);
}
