/** Dashboard client routes (relative to the Express mount). */
export const DASHBOARD_PAGE_SUFFIXES = [
  '/mocks',
  '/overrides',
  '/timeline',
  '/atlas',
  '/network',
  '/fixture-pool',
  '/date-config',
  '/settings',
] as const;

/**
 * Resolve a script `src` against the current page URL (not origin).
 * Relative `./assets/*.js` on `/mockifyer/overrides` must become `/mockifyer/assets/*.js`.
 */
export function resolveScriptSrcToMountPrefix(src: string, pageUrl: string): string {
  if (!src || !src.includes('/assets/')) {
    return '';
  }
  try {
    const u = new URL(src, pageUrl);
    const idx = u.pathname.indexOf('/assets/');
    if (idx > 0) {
      return u.pathname.slice(0, idx);
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * Infer the Express mount from a deep-link pathname such as `/mockifyer/overrides`.
 * Root routes (`/overrides`, `/`) have no prefix.
 */
export function inferMountPrefixFromPathname(pathname: string): string {
  const trimmed = (pathname.split('?')[0] || '').replace(/\/+$/, '') || '/';
  if (trimmed === '/') {
    return '';
  }
  for (const suffix of DASHBOARD_PAGE_SUFFIXES) {
    if (trimmed === suffix) {
      return '';
    }
    if (trimmed.endsWith(suffix)) {
      const prefix = trimmed.slice(0, trimmed.length - suffix.length);
      return prefix.startsWith('/') ? prefix : '';
    }
  }
  return '';
}
