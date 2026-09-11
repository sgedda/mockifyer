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
 * Root routes (`/overrides`, `/`) have no prefix. The dashboard home (Stats) is the
 * mount itself (`/mockifyer`).
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
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * React Router basename: location mount wins so a Vite `base` of `/` still works
 * when the host embeds the UI under `/mockifyer`.
 */
export function resolveRouterBasename(
  viteBase: string,
  mountPrefix: string
): string | undefined {
  if (mountPrefix) {
    return mountPrefix;
  }
  if (viteBase === '/' || viteBase === './') {
    return undefined;
  }
  const withoutTrailing = viteBase.replace(/\/+$/, '');
  return withoutTrailing === '' ? undefined : withoutTrailing;
}

/**
 * Origin path for `/api` calls. Prefer the Express mount from the page URL so a
 * root-absolute Vite build still talks to `/mockifyer/api` instead of `/api`.
 */
export function resolveApiBase(viteBase: string, mountPrefix: string): string {
  if (mountPrefix) {
    return `${mountPrefix}/api`.replace(/\/{2,}/g, '/');
  }
  if (viteBase === '/' || viteBase === './') {
    return '/api';
  }
  const root = viteBase.endsWith('/') ? viteBase : `${viteBase}/`;
  return `${root}api`.replace(/\/{2,}/g, '/');
}
