/**
 * Infer Express mount prefix (e.g. `/dashboard`) from this module's emitted chunk URL.
 * Vite/Rollup sets `import.meta.url` to the real file URL (e.g. `.../dashboard/assets/main-xxx.js`).
 */
function inferAppMountPrefixFromImportMeta(): string {
  try {
    const u = new URL(import.meta.url);
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
 * Fallback: infer from `<script src=".../assets/...">` when `import.meta.url` is not a network URL
 * (e.g. some test runners) or does not contain `/assets/`.
 */
function inferAppMountPrefixFromDom(): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i].getAttribute('src');
    if (!src || !src.includes('/assets/')) {
      continue;
    }
    try {
      const u = new URL(src, window.location.origin);
      const idx = u.pathname.indexOf('/assets/');
      if (idx > 0) {
        return u.pathname.slice(0, idx);
      }
    } catch {
      continue;
    }
  }
  return '';
}

/** Mount prefix before `/assets/` (e.g. `/dashboard`), or `''` when served from site root. */
export function inferAppMountPrefix(): string {
  return inferAppMountPrefixFromImportMeta() || inferAppMountPrefixFromDom();
}

/**
 * Vite sets `import.meta.env.BASE_URL` from `base` in `vite.config.ts`
 * (e.g. `/`, `./`, or `/dashboard/`).
 */
export function getDashboardRouterBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;
  if (base === '/' || base === './') {
    if (base === './') {
      const mount = inferAppMountPrefix();
      return mount === '' ? undefined : mount;
    }
    return undefined;
  }
  const withoutTrailing = base.replace(/\/+$/, '');
  return withoutTrailing === '' ? undefined : withoutTrailing;
}

/**
 * Origin path prefix for API calls (e.g. `/api` or `/dashboard/api`).
 * With portable `base: './'`, mount is taken from the bundle URL so `/api` is never used incorrectly under a subpath.
 */
export function getApiBase(): string {
  const base = import.meta.env.BASE_URL;
  if (base === '/') {
    return '/api';
  }
  if (base === './') {
    const mount = inferAppMountPrefix();
    if (mount === '') {
      return '/api';
    }
    return `${mount}/api`.replace(/\/{2,}/g, '/');
  }
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}api`.replace(/\/{2,}/g, '/');
}
