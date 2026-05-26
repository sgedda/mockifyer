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
