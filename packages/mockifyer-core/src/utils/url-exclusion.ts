import { isMockifyerDashboardProxyApiUrl } from './join-proxy-dashboard-api-url';
import { resolveOutboundUrl } from './recording-exclusion';

/**
 * Metro sync endpoint path markers that must always bypass Mockifyer
 * (even when `excludedUrls` replaces the default exclusion list).
 */
export const MOCKIFYER_SYNC_ENDPOINT_MARKERS = [
  '/mockifyer-save',
  '/mockifyer-clear',
  '/mockifyer-sync',
  '/mockifyer-atlas-html',
  '/mockifyer-atlas-screenshot',
  '/mockifyer-atlas-render',
  /** Metro domain-path rules discovery merge. */
  '/mockifyer-domain-path-rules',
] as const;

/**
 * Default excluded URLs that should never be recorded or mocked
 */
export const DEFAULT_EXCLUDED_URLS = [
  ...MOCKIFYER_SYNC_ENDPOINT_MARKERS,
  /** Metro scenario sync — uses cache-bust `?t=`; recording each fetch creates duplicate mocks. */
  '/mockifyer-scenario-config',
  'api.resend.com',
];

/**
 * True when `text` references a Mockifyer Metro sync endpoint path.
 * Used for request/response interceptor and save-path defense-in-depth checks.
 */
export function containsMockifyerSyncEndpointMarker(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  return MOCKIFYER_SYNC_ENDPOINT_MARKERS.some((marker) => text.includes(marker));
}

/**
 * Checks if a URL should be excluded from recording/mocking based on the exclusion list
 * @param url The URL to check
 * @param excludedUrls Array of URL patterns to exclude (supports partial matches)
 * @returns true if the URL should be excluded, false otherwise
 */
export function shouldExcludeUrl(url: string | null | undefined, excludedUrls?: string[]): boolean {
  if (!url) {
    return false;
  }

  const exclusionList = excludedUrls && excludedUrls.length > 0
    ? excludedUrls
    : DEFAULT_EXCLUDED_URLS;

  return exclusionList.some((pattern) => url.includes(pattern));
}

/**
 * When true, outbound HTTP should skip Mockifyer entirely (no proxy, mock lookup, or recording).
 * Resolves relative URLs with `baseUrl` when provided.
 *
 * Dashboard `/api/proxy` is always bypassed (even when `excludedUrls` replaces defaults) so the
 * internal proxy POST is never re-intercepted or shown as a user-visible hop.
 */
export function shouldBypassMockifyerForUrl(
  rawUrl: string | null | undefined,
  excludedUrls?: string[],
  baseUrl?: string | null
): boolean {
  const resolved = resolveOutboundUrl(rawUrl, baseUrl);
  if (isMockifyerDashboardProxyApiUrl(resolved) || isMockifyerDashboardProxyApiUrl(rawUrl)) {
    return true;
  }
  if (resolved && shouldExcludeUrl(resolved, excludedUrls)) {
    return true;
  }
  return shouldExcludeUrl(rawUrl, excludedUrls);
}
