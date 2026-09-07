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

function normalizeDashboardApiPath(url: string): string | null {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

function pathIsDashboardProxy(path: string): boolean {
  return path === '/api/proxy' || path.endsWith('/api/proxy');
}

function pathIsDashboardNetworkEvents(path: string): boolean {
  return (
    path === '/api/network-events' ||
    path.endsWith('/api/network-events') ||
    path.includes('/api/network-events/')
  );
}

function pathIsDashboardAtlas(path: string): boolean {
  return path === '/api/atlas' || path.endsWith('/api/atlas') || path.includes('/api/atlas/');
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
  if (path) {
    return pathIsDashboardProxy(path);
  }
  return /(?:^|\/)api\/proxy\/?(?:\?|#|$)/i.test(url);
}

/**
 * True when `url` targets Mockifyer dashboard plumbing that must never be mocked or recorded:
 * `/api/proxy`, `/api/network-events`, `/api/atlas` (and subpaths).
 *
 * SDK observability POSTs use patched `fetch` in many apps; without this bypass those POSTs
 * get recorded as mocks and can flood Redis / the dashboard mock list.
 */
export function isMockifyerDashboardPlumbingApiUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  if (isMockifyerDashboardProxyApiUrl(url)) {
    return true;
  }
  const path = normalizeDashboardApiPath(url);
  if (path) {
    return pathIsDashboardNetworkEvents(path) || pathIsDashboardAtlas(path);
  }
  return (
    /(?:^|\/)api\/network-events(?:\/|\?|#|$)/i.test(url) ||
    /(?:^|\/)api\/atlas(?:\/|\?|#|$)/i.test(url)
  );
}
