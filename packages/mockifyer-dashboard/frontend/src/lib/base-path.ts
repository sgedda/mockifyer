/**
 * Vite sets `import.meta.env.BASE_URL` from `base` in `vite.config.ts`
 * (e.g. `/` or `/dashboard/`).
 */
export function getDashboardRouterBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;
  if (base === '/') {
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
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}api`.replace(/\/{2,}/g, '/');
}
