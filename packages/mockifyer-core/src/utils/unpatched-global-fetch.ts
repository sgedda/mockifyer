/**
 * Fetch that does not go through Mockifyer-patched `global.fetch`.
 * Used for dashboard plumbing POSTs (network-events, atlas) so they never re-enter interceptors.
 */
export function resolveUnpatchedFetch(): typeof fetch | undefined {
  const fromGlobal =
    typeof globalThis !== 'undefined'
      ? (globalThis as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch
      : undefined;
  if (typeof fromGlobal === 'function') {
    return fromGlobal;
  }
  if (typeof fetch === 'function') {
    return fetch;
  }
  return undefined;
}
