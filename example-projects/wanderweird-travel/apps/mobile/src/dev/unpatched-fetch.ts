/**
 * Use the pre-patch fetch so dashboard / Metro control-plane calls are never mocked.
 */
export function unpatchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const globalWithOriginal = globalThis as typeof globalThis & {
    __mockifyer_original_fetch?: typeof fetch;
  };
  const fetchFn = globalWithOriginal.__mockifyer_original_fetch ?? fetch;
  return fetchFn(input, init);
}
