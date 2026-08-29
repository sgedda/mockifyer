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

/** Dashboard HTTP paths that must never be mocked, recorded, or shown as user hops. */
const DASHBOARD_PLUMBING_PATHS: ReadonlyArray<{ suffix: string; includeSubpaths: boolean }> = [
  { suffix: '/api/proxy', includeSubpaths: false },
  { suffix: '/api/network-events', includeSubpaths: true },
];

function normalizeDashboardPathname(pathname: string): string {
  return pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
}

function pathMatchesDashboardPlumbing(path: string): boolean {
  return DASHBOARD_PLUMBING_PATHS.some(({ suffix, includeSubpaths }) => {
    if (path === suffix || path.endsWith(suffix)) {
      return true;
    }
    return includeSubpaths && path.includes(`${suffix}/`);
  });
}

/**
 * True when `url` targets dashboard plumbing (`/api/proxy` or `/api/network-events`).
 * These requests must never be mocked, recorded, or shown as user-visible hops.
 */
export function isMockifyerDashboardPlumbingUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url, 'http://localhost');
    return pathMatchesDashboardPlumbing(normalizeDashboardPathname(parsed.pathname));
  } catch {
    return /(?:^|\/)api\/(?:proxy|network-events)(?:\/[^?#]*)?(?:\?|#|$)/i.test(url);
  }
}

/**
 * True when `url` targets dashboard plumbing (`/api/proxy` or `/api/network-events`).
 * These requests must never be mocked, recorded, or shown as user-visible hops.
 */
export function isMockifyerDashboardProxyApiUrl(url: string | null | undefined): boolean {
  return isMockifyerDashboardPlumbingUrl(url);
}
