/**
 * Append a params object onto a URL (absolute or relative).
 * Used when hop logs / include-trace must reconstruct the wire URL from
 * axios/fetch `params` that were stripped off `config.url`.
 */
export function appendParamsToUrl(
  url: string,
  params: Record<string, unknown> | undefined | null,
): string {
  if (!params || typeof params !== 'object') {
    return url;
  }

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (entries.length === 0) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    for (const [key, value] of entries) {
      urlObj.searchParams.append(key, String(value));
    }
    return urlObj.toString();
  } catch {
    const qs = new URLSearchParams();
    for (const [key, value] of entries) {
      qs.append(key, String(value));
    }
    const query = qs.toString();
    if (!query) return url;
    return url.includes('?') ? `${url}&${query}` : `${url}?${query}`;
  }
}

/**
 * Merge a sanitized query string (with or without leading `?`) onto a URL
 * that is missing a search component. No-op when the URL already has `?`.
 */
export function mergeQueryStringOntoUrl(url: string, query: string | undefined): string {
  const trimmedUrl = (url || '').trim();
  if (!trimmedUrl || !query || !query.trim()) {
    return trimmedUrl;
  }
  if (trimmedUrl.includes('?')) {
    return trimmedUrl;
  }
  const q = query.trim().startsWith('?') ? query.trim().slice(1) : query.trim();
  if (!q) return trimmedUrl;
  return `${trimmedUrl}?${q}`;
}
