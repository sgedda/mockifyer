import { ENV_VARS, type MockifyerConfig } from '../types';

/**
 * Dashboard URL resolution with no dependency on network-log or atlas-usage.
 * Those two modules called each other.
 */
export function resolveNetworkLogDashboardUrl(
  config: Pick<MockifyerConfig, 'networkLog' | 'proxy'>
): string | undefined {
  if (config.networkLog?.enabled === false) return undefined;
  const fromEnv =
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_DASHBOARD_URL]?.trim() : undefined;
  if (fromEnv) return fromEnv;
  const fromConfig = config.networkLog?.dashboardBaseUrl?.trim();
  if (fromConfig) return fromConfig;
  const fromProxy = config.proxy?.baseUrl?.trim();
  if (fromProxy) return fromProxy;
  return undefined;
}
