import { joinProxyDashboardApiUrl } from './join-proxy-dashboard-api-url';

const HEALTH_TIMEOUT_MS = 800;

/** Body shape returned by mockifyer-dashboard `GET /api/health` (subset). */
export interface DashboardHealthPayload {
  status?: string;
  provider?: string;
  redisOk?: boolean | null;
}

/**
 * True when mockifyer-dashboard responds to **`GET /api/health`** with **`provider === 'redis'`**
 * **`redisOk === true`**. Same gate as React Native strict proxy vs Hybrid fallback (`setupMockifyerForReactNative`)
 * and Node **`initMockifyerForDashboardProxy`** when health checks are enabled.
 */
export async function canUseDashboardRedisProxy(proxyBaseUrl: string | undefined): Promise<boolean> {
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
    return data?.provider === 'redis' && data?.redisOk === true;
  } catch {
    return false;
  }
}
