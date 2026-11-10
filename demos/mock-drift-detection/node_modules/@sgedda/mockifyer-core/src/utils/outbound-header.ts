/**
 * Flatten an axios/fetch-style header bag into a plain record.
 *
 * Handles `Headers` (forEach), axios `AxiosHeaders`, and plain objects; array
 * values join with `, ` the way HTTP does. Used to keep the outbound headers on
 * the hop record so Atlas can rebuild a runnable request (curl).
 */
export function outboundHeadersToRecord(
  headers: unknown
): Record<string, string> | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const out: Record<string, string> = {};
  const put = (key: unknown, value: unknown): void => {
    const name = typeof key === 'string' ? key.trim() : '';
    if (!name || value == null) return;
    const text = Array.isArray(value)
      ? value.filter((v) => v != null).map((v) => String(v)).join(', ')
      : String(value);
    if (text.trim() === '') return;
    out[name.toLowerCase()] = text;
  };

  const bag = headers as Record<string, unknown> & {
    forEach?: (fn: (value: unknown, key: unknown) => void) => void;
    toJSON?: () => Record<string, unknown>;
  };

  if (typeof bag.forEach === 'function') {
    bag.forEach((value, key) => put(key, value));
    return Object.keys(out).length > 0 ? out : undefined;
  }

  if (typeof bag.toJSON === 'function') {
    try {
      for (const [k, v] of Object.entries(bag.toJSON() ?? {})) {
        put(k, v);
      }
      return Object.keys(out).length > 0 ? out : undefined;
    } catch {
      // fall through to own-entries
    }
  }

  for (const [k, v] of Object.entries(bag)) {
    if (typeof v === 'function' || v == null) continue;
    // axios keeps per-method bags (common/get/post/...) — flatten one level.
    if (typeof v === 'object' && !Array.isArray(v)) {
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        put(nk, nv);
      }
      continue;
    }
    put(k, v);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Shared helper for reading outbound Mockifyer headers from axios/fetch-style header bags. */
export function getOutboundHeaderValue(headers: unknown, canonicalLower: string): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const h = headers as Record<string, unknown> & {
    get?: (name: string) => unknown;
    forEach?: (fn: (value: string, key: string) => void) => void;
  };

  if (typeof h.get === 'function') {
    const v = h.get(canonicalLower);
    if (v == null) {
      return undefined;
    }
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
  }

  if (typeof h.forEach === 'function') {
    let found: string | undefined;
    h.forEach((value: string, key: string) => {
      if (key && key.toLowerCase() === canonicalLower && value != null) {
        const s = String(value).trim();
        if (s) {
          found = s;
        }
      }
    });
    return found;
  }

  for (const [k, v] of Object.entries(h)) {
    if (k && k.toLowerCase() === canonicalLower && v != null) {
      const s = String(v).trim();
      if (s) {
        return s;
      }
    }
  }
  return undefined;
}
