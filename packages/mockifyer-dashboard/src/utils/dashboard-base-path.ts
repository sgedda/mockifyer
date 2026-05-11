/**
 * Normalizes the dashboard public URL path for Vite `base`.
 * Build-time only (baked into `index.html` and chunk URLs).
 *
 * @param raw - Typically `process.env.VITE_MOCKIFYER_DASHBOARD_BASE`
 * @returns Vite-compatible `base`, e.g. `/` or `/dashboard/`
 */
export function normalizeViteDashboardBase(raw?: string): string {
  const trimmed = (raw ?? '/').trim();
  if (trimmed === '' || trimmed === '/') {
    return '/';
  }
  let segment = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  segment = segment.replace(/\/+$/, '');
  if (segment === '' || segment === '/') {
    return '/';
  }
  return `${segment}/`;
}

/**
 * Normalizes the Express mount path for the standalone CLI (or tests).
 * Must match the path implied by {@link normalizeViteDashboardBase} used when building the frontend.
 *
 * @param raw - CLI `--base` or `process.env.MOCKIFYER_DASHBOARD_BASE`
 * @returns `/` for root, otherwise a path like `/dashboard` (no trailing slash)
 */
export function normalizeExpressMountPath(raw?: string): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '' || trimmed === '/') {
    return '/';
  }
  let segment = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  segment = segment.replace(/\/+$/, '');
  if (segment === '' || segment === '/') {
    return '/';
  }
  return segment;
}
