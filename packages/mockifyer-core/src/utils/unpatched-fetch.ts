const MOCKIFYER_ORIGINAL_FETCH_KEY = '__mockifyer_original_fetch';

/**
 * Prefer the unpatched `fetch` stored when Mockifyer patches `global.fetch`.
 * Dashboard plumbing (`/api/proxy`, `/api/network-events`, `/api/atlas`) must not
 * re-enter interceptors.
 */
export function resolveUnpatchedGlobalFetch(fetchFn?: typeof fetch): typeof fetch | undefined {
  if (typeof fetchFn === 'function') {
    return fetchFn;
  }
  try {
    const g = globalThis as typeof globalThis & { [MOCKIFYER_ORIGINAL_FETCH_KEY]?: typeof fetch };
    if (typeof g[MOCKIFYER_ORIGINAL_FETCH_KEY] === 'function') {
      return g[MOCKIFYER_ORIGINAL_FETCH_KEY];
    }
  } catch {
    // ignore — fall through to global fetch
  }
  return typeof fetch === 'function' ? fetch : undefined;
}
