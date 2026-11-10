/**
 * Request headers that must not be forwarded when Mockifyer rebuilds an upstream
 * body (dashboard `/api/proxy`, live capture). Forwarding a stale `Content-Length`
 * after rewriting FormData/JSON makes undici throw
 * `RequestContentLengthMismatchError` and the user-facing request fails.
 */
const OMITTED_PROXY_UPSTREAM_REQUEST_HEADERS = new Set([
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'te',
  'trailer',
  'upgrade',
  'expect',
  'content-encoding',
]);

/**
 * True when `name` is a hop-by-hop or length/encoding header that must not be
 * copied onto a rebuilt upstream fetch.
 */
export function isOmittedProxyUpstreamRequestHeader(name: string): boolean {
  return OMITTED_PROXY_UPSTREAM_REQUEST_HEADERS.has(name.trim().toLowerCase());
}

function appendHeader(
  out: Record<string, string>,
  key: string,
  value: unknown
): void {
  if (value === undefined || value === null) {
    return;
  }
  if (isOmittedProxyUpstreamRequestHeader(key)) {
    return;
  }
  out[key] = String(value);
}

interface HeadersForEachLike {
  forEach: (callback: (value: string, key: string) => void) => void;
}

/** Request header bag accepted by fetch / axios / Express proxy envelopes. */
export type ProxyUpstreamHeaderInput =
  | Record<string, unknown>
  | Array<[string, unknown]>
  | HeadersForEachLike
  | null
  | undefined;

/**
 * Copy request headers for an upstream fetch, dropping hop-by-hop and
 * body-length headers so the runtime can set `Content-Length` from the body
 * we actually send.
 */
export function omitProxyUpstreamRequestHeaders(
  headers?: ProxyUpstreamHeaderInput
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) {
    return out;
  }

  if (Array.isArray(headers)) {
    for (const pair of headers) {
      if (Array.isArray(pair) && pair.length >= 2) {
        appendHeader(out, String(pair[0]), pair[1]);
      }
    }
    return out;
  }

  if (typeof (headers as HeadersForEachLike).forEach === 'function') {
    (headers as HeadersForEachLike).forEach((value, key) => {
      appendHeader(out, key, value);
    });
    return out;
  }

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    appendHeader(out, key, value);
  }
  return out;
}
