/**
 * Builds a full URL to the Mockifyer dashboard HTTP API under a given `proxyBaseUrl`.
 *
 * `proxyBaseUrl` may include a path prefix (e.g. `https://host/apim-prefix/mockifyer/`).
 * Avoid `new URL('/api/...', proxyBaseUrl)` — a leading `/` on the second argument replaces the
 * entire pathname of the base URL, so the gateway prefix is lost.
 *
 * @param proxyBaseUrl - Origin and optional path prefix (with or without trailing slash)
 * @param apiSubPath - Path under that prefix without a leading slash (e.g. `api/health`, `api/proxy`)
 */
export function joinProxyDashboardApiUrl(proxyBaseUrl: string, apiSubPath: string): string {
  const normalizedBase = proxyBaseUrl.trim().replace(/\/+$/, '');
  const normalizedPath = apiSubPath.trim().replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
}

function normalizeDashboardApiPath(url: string): string | undefined {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

/**
 * True when `url` targets the dashboard `/api/proxy` endpoint (Mockifyer plumbing).
 * These requests must never be mocked, recorded, or shown as user-visible hops.
 */
export function isMockifyerDashboardProxyApiUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const path = normalizeDashboardApiPath(url);
  if (path != null) {
    return path === '/api/proxy' || path.endsWith('/api/proxy');
  }
  return /(?:^|\/)api\/proxy\/?(?:\?|#|$)/i.test(url);
}

/**
 * True when `url` targets dashboard `/api/network-events` (including `/trace`, `/config`).
 * SDK observability POSTs must never be re-intercepted by patched `fetch`/`axios`.
 */
export function isMockifyerDashboardNetworkEventsApiUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const path = normalizeDashboardApiPath(url);
  if (path != null) {
    return (
      path === '/api/network-events' ||
      path.endsWith('/api/network-events') ||
      path.includes('/api/network-events/')
    );
  }
  return /(?:^|\/)api\/network-events(?:\/|\?|#|$)/i.test(url);
}

/**
 * Dashboard HTTP plumbing that must always bypass Mockifyer interception.
 */
export function isMockifyerDashboardPlumbingApiUrl(url: string | null | undefined): boolean {
  return isMockifyerDashboardProxyApiUrl(url) || isMockifyerDashboardNetworkEventsApiUrl(url);
}
