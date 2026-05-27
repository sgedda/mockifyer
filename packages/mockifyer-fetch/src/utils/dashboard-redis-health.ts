import { joinProxyDashboardApiUrl } from './join-proxy-dashboard-api-url';

const HEALTH_TIMEOUT_MS = 800;

/** Body shape returned by mockifyer-dashboard `GET /api/health` (subset). */
export interface DashboardHealthPayload {
  status?: string;
  provider?: string;
  redisOk?: boolean | null;
  sqliteOk?: boolean | null;
  /** When true, dashboard central store (redis or sqlite) is ready for `/api/proxy`. */
  centralStoreOk?: boolean | null;
}

function centralStoreHealthy(data: DashboardHealthPayload): boolean {
  if (data.centralStoreOk === true) {
    return true;
  }
  if (data.provider === 'redis' && data.redisOk === true) {
    return true;
  }
  if (data.provider === 'sqlite' && data.sqliteOk === true) {
    return true;
  }
  return false;
}

/**
 * True when mockifyer-dashboard responds to **`GET /api/health`** with a healthy central store
 * (**`provider === 'redis'`** and **`redisOk`**, or **`provider === 'sqlite'`** and **`sqliteOk`**,
 * or **`centralStoreOk === true`**). Same gate as React Native strict proxy / **`initMockifyerForDashboardProxy`**.
 */
export async function canUseDashboardCentralProxy(proxyBaseUrl: string | undefined): Promise<boolean> {
  if (!proxyBaseUrl?.trim()) {
    return false;
  }
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeout = setTimeout(() => controller?.abort(), HEALTH_TIMEOUT_MS);
    const url = joinProxyDashboardApiUrl(proxyBaseUrl.trim(), 'api/health');
    const res = await fetch(url, { signal: controller?.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return false;
    }
    const data = (await res.json()) as DashboardHealthPayload;
    return centralStoreHealthy(data);
  } catch {
    return false;
  }
}

/**
 * @deprecated Use {@link canUseDashboardCentralProxy}. Kept for existing imports.
 */
export async function canUseDashboardRedisProxy(proxyBaseUrl: string | undefined): Promise<boolean> {
  return canUseDashboardCentralProxy(proxyBaseUrl);
}
