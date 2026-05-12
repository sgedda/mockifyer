/**
 * When Vite `base` is `./`, `import.meta.env.BASE_URL` is `./` and does not include the mount path.
 * Infer the Express mount prefix (e.g. `/dashboard`) from the loaded main bundle script URL.
 */
export function inferAppMountPrefix(): string {
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

/** Origin-relative API prefix (e.g. `/api` or `/dashboard/api`). */
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
