/**
 * One call through the dashboard proxy is recorded twice: by the service's own
 * HTTP client (`transport: 'fetch'` or `'axios'`) and by the dashboard proxy
 * (`transport: 'proxy'`, with duration). Both carry the same hop ids. The proxy
 * record is the call that actually reached the backend.
 *
 * Timestamps cannot pair them: the proxy record can land tens of seconds after the
 * client's (store lookups before the upstream call are not in its duration). Each
 * proxied call yields exactly one record of each kind, so callers pair them one-to-one
 * and skip records that are already paired.
 */

/** Marks a record that already absorbed its client/proxy twin. */
export const NETWORK_EVENT_TWINNED_KEY = '__mockifyerTwinned';

export interface NetworkEventTwinFields {
  requestId?: string | null;
  parentRequestId?: string | null;
  transport?: string | null;
  [NETWORK_EVENT_TWINNED_KEY]?: boolean;
}

/**
 * True when `a` and `b` can be the client-side and proxy-side records of one call:
 * same hop ids, one proxy record and one fetch/axios record, and neither already paired.
 *
 * Self-contained on purpose: the Atlas live page embeds this function's source.
 */
export function isFetchProxyTwin(a: NetworkEventTwinFields, b: NetworkEventTwinFields): boolean {
  const trim = (value: string | null | undefined): string => (value ? String(value).trim() : '');
  const isClientSide = (transport: string | null | undefined): boolean =>
    transport === 'fetch' || transport === 'axios';
  if (a.__mockifyerTwinned || b.__mockifyerTwinned) return false;
  const requestId = trim(a.requestId);
  if (!requestId || requestId !== trim(b.requestId)) return false;
  if (trim(a.parentRequestId) !== trim(b.parentRequestId)) return false;
  return (
    (isClientSide(a.transport) && b.transport === 'proxy') ||
    (a.transport === 'proxy' && isClientSide(b.transport))
  );
}
