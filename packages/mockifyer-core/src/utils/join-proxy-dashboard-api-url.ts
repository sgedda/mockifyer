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
