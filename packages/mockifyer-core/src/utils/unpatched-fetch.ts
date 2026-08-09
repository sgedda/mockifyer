const MOCKIFYER_ORIGINAL_FETCH_KEY = '__mockifyer_original_fetch';

/**
 * Prefer the unpatched `fetch` stored when Mockifyer patches `global.fetch`, so
 * internal dashboard POSTs (`/api/proxy`, `/api/network-events`) are not re-intercepted.
 */
export function resolveUnpatchedFetch(explicit?: typeof fetch): typeof fetch {
  if (explicit) {
    return explicit;
  }
  try {
    const g = globalThis as typeof globalThis & { [MOCKIFYER_ORIGINAL_FETCH_KEY]?: typeof fetch };
    if (typeof g[MOCKIFYER_ORIGINAL_FETCH_KEY] === 'function') {
      return g[MOCKIFYER_ORIGINAL_FETCH_KEY]!;
    }
  } catch {
    // ignore
  }
  return fetch;
}
