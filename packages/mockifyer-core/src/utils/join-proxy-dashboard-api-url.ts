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

/**
 * True when `url` targets the dashboard `/api/proxy` endpoint (Mockifyer plumbing).
 * These requests must never be mocked, recorded, or shown as user-visible hops.
 */
export function isMockifyerDashboardProxyApiUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url, 'http://localhost');
    const path = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return path === '/api/proxy' || path.endsWith('/api/proxy');
  } catch {
    return /(?:^|\/)api\/proxy\/?(?:\?|#|$)/i.test(url);
  }
}
