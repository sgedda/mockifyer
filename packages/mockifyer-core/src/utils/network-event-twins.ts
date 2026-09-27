/**
 * One call through the dashboard proxy is recorded twice: by the service's own
 * HTTP client (`transport: 'fetch'` or `'axios'`, logged when the call returns)
 * and by the dashboard proxy (`transport: 'proxy'`, with duration). Both carry
 * the same hop ids. The proxy record is the call that actually reached the backend.
 */

/** Slack between the two records of one call, on top of the proxy's own duration. */
export const PROXY_TWIN_WINDOW_MS = 5000;

export interface NetworkEventTwinFields {
  requestId?: string | null;
  parentRequestId?: string | null;
  transport?: string | null;
  timestamp?: string | null;
  durationMs?: number | null;
}

/**
 * True when `a` and `b` are the fetch-side and proxy-side records of the same call.
 * Stored hop ids are reused across calls, so matching ids alone is not enough:
 * the records must also be close in time.
 *
 * Self-contained on purpose: the Atlas live page embeds this function's source.
 */
export function isFetchProxyTwin(
  a: NetworkEventTwinFields,
  b: NetworkEventTwinFields,
  windowMs: number
): boolean {
  const trim = (value: string | null | undefined): string => (value ? String(value).trim() : '');
  const requestId = trim(a.requestId);
  if (!requestId || requestId !== trim(b.requestId)) return false;
  if (trim(a.parentRequestId) !== trim(b.parentRequestId)) return false;
  const proxy = a.transport === 'proxy' ? a : b.transport === 'proxy' ? b : null;
  const fetchSide = proxy === a ? b : a;
  if (!proxy || (fetchSide.transport !== 'fetch' && fetchSide.transport !== 'axios')) return false;
  const proxyAt = Date.parse(String(proxy.timestamp || ''));
  const fetchAt = Date.parse(String(fetchSide.timestamp || ''));
  if (!Number.isFinite(proxyAt) || !Number.isFinite(fetchAt)) return false;
  const duration = typeof proxy.durationMs === 'number' && proxy.durationMs > 0 ? proxy.durationMs : 0;
  return Math.abs(proxyAt - fetchAt) <= duration + windowMs;
}
