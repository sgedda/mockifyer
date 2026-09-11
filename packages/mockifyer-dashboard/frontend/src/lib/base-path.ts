import {
  inferMountPrefixFromPathname,
  resolveApiBase,
  resolveRouterBasename,
  resolveScriptSrcToMountPrefix,
} from './dashboard-mount'

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
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return '';
  }
  const pageUrl = window.location.href;
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i].getAttribute('src');
    if (!src) {
      continue;
    }
    const mount = resolveScriptSrcToMountPrefix(src, pageUrl);
    if (mount) {
      return mount;
    }
  }
  return '';
}

function inferAppMountPrefixFromLocation(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return inferMountPrefixFromPathname(window.location.pathname);
}

/** Mount prefix before `/assets/` (e.g. `/dashboard`), or `''` when served from site root. */
export function inferAppMountPrefix(): string {
  if (typeof window !== 'undefined') {
    const fromPath = inferMountPrefixFromPathname(window.location.pathname);
    if (fromPath) {
      return fromPath;
    }
  }
  return (
    inferAppMountPrefixFromImportMeta() ||
    inferAppMountPrefixFromDom() ||
    inferAppMountPrefixFromLocation()
  );
}

/**
 * Vite sets `import.meta.env.BASE_URL` from `base` in `vite.config.ts`
 * (e.g. `/`, `./`, or `/dashboard/`). Location mount always wins so a host
 * that built with `base: '/'` still calls `/mockifyer/api` under an embed.
 */
export function getDashboardRouterBasename(): string | undefined {
  return resolveRouterBasename(import.meta.env.BASE_URL, inferAppMountPrefix());
}

/**
 * Origin path prefix for API calls (e.g. `/api` or `/mockifyer/api`).
 * With portable `base: './'` (or a mistaken `/`), mount is taken from the page URL.
 */
export function getApiBase(): string {
  return resolveApiBase(import.meta.env.BASE_URL, inferAppMountPrefix());
}
