/**
 * Scrub network events before they are written into the public Atlas report
 * (GitHub Pages). The dashboard ring keeps raw headers and the original URL
 * inside `errorMessage` so local curl still works; this pass is the publish boundary.
 */

const SECRET_PARAM_EXACT = new Set(['key', 'auth', 'authorization', 'signature', 'sig']);

/**
 * True when a query-parameter or header name is a credential.
 * Hyphens and underscores are treated the same (`api-key` and `api_key`).
 * `author` and `keyboard` are not credentials.
 */
export function isSecretParamName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/-/g, '_');
  if (SECRET_PARAM_EXACT.has(normalized)) return true;
  return (
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('apikey') ||
    normalized.includes('api_key') ||
    normalized.includes('credential') ||
    normalized.includes('signature')
  );
}

function decodeParamName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * Redact secret query parameters and URL userinfo anywhere in a string.
 * Matches `?param=`, `&param=`, and `#param=` so hash fragments and
 * `errorMessage` text (`GET https://host/path?apikey=SECRET: fetch failed`) are covered.
 */
export function scrubUrlSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let scrubbed = text.replace(
    /([a-z][a-z0-9+.-]*:\/\/)([^/\s@:]+:[^/\s@]+)@/gi,
    '$1<redacted>@'
  );

  scrubbed = scrubbed.replace(
    /([?&#])([^=&#\s]+)=([^&#\s]*)/g,
    (full, separator: string, name: string) => {
      if (!isSecretParamName(decodeParamName(name))) return full;
      return `${separator}${name}=<redacted>`;
    }
  );

  return scrubbed;
}

function scrubCredentialSchemes(text: string): string {
  return text.replace(/\b(Bearer|Basic|OAuth|Digest)\s+\S+/gi, '$1 <redacted>');
}

function scrubFreeText(text: string): string {
  return scrubUrlSecrets(scrubCredentialSchemes(text));
}

function isSecretHeaderName(name: string): boolean {
  const lower = name.toLowerCase();
  if (
    lower === 'authorization' ||
    lower === 'proxy-authorization' ||
    lower === 'cookie' ||
    lower === 'set-cookie'
  ) {
    return true;
  }
  return isSecretParamName(lower);
}

function redactHeaderValue(name: string, value: unknown): string {
  const text = value == null ? '' : String(value);
  const lower = name.toLowerCase();
  if (lower === 'authorization' || lower === 'proxy-authorization') {
    const scheme = text.split(/\s+/, 1)[0] ?? '';
    if (/^(bearer|basic|oauth|digest)$/i.test(scheme)) {
      return `${scheme} <redacted>`;
    }
    return '<redacted>';
  }
  return '<redacted>';
}

function scrubHeaders(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = isSecretHeaderName(name) ? redactHeaderValue(name, value) : scrubFreeText(String(value ?? ''));
  }
  return out;
}

/**
 * Redact token-like strings and secret-named fields. URL-shaped strings are
 * passed through {@link scrubUrlSecrets} so a JSON `url` field cannot keep
 * `?apikey=` after the top-level `url` property was masked.
 */
export function scrubObjectSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    const withUrls = scrubFreeText(obj);
    if (withUrls !== obj) return withUrls;
    if (obj.length > 30 && /^[A-Za-z0-9+/=_.-]{30,}$/.test(obj)) {
      return '<redacted>';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubObjectSecrets(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('api-key') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('credential') ||
        lowerKey === 'cookie' ||
        lowerKey === 'set-cookie'
      ) {
        result[key] = '<redacted>';
      } else {
        result[key] = scrubObjectSecrets(value);
      }
    }
    return result;
  }

  return obj;
}

function scrubBodyPreview(body: unknown): unknown {
  if (typeof body === 'string') {
    try {
      return JSON.stringify(scrubObjectSecrets(JSON.parse(body)));
    } catch {
      return scrubFreeText(body).replace(/\b[A-Za-z0-9+/=_.-]{30,}\b/g, '<redacted>');
    }
  }
  return JSON.stringify(scrubObjectSecrets(body));
}

function scrubQueryField(query: string): string {
  const prefixed = query.startsWith('?') || query.startsWith('#') ? query : `?${query}`;
  const scrubbed = scrubUrlSecrets(prefixed);
  if (query.startsWith('?') || query.startsWith('#')) return scrubbed;
  return scrubbed.replace(/^\?/, '');
}

/**
 * Copy of one network event safe to embed in public Atlas HTML and `atlas-events.json`.
 */
export function scrubNetworkEvent(event: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = { ...event };

  if (scrubbed.requestHeaders && typeof scrubbed.requestHeaders === 'object') {
    scrubbed.requestHeaders = scrubHeaders(scrubbed.requestHeaders as Record<string, unknown>);
  }
  if (scrubbed.responseHeaders && typeof scrubbed.responseHeaders === 'object') {
    scrubbed.responseHeaders = scrubHeaders(scrubbed.responseHeaders as Record<string, unknown>);
  }

  if (scrubbed.requestBodyPreview) {
    scrubbed.requestBodyPreview = scrubBodyPreview(scrubbed.requestBodyPreview);
  }
  if (scrubbed.responseBodyPreview) {
    scrubbed.responseBodyPreview = scrubBodyPreview(scrubbed.responseBodyPreview);
  }

  if (typeof scrubbed.url === 'string') {
    scrubbed.url = scrubUrlSecrets(scrubbed.url);
  }
  if (typeof scrubbed.path === 'string') {
    scrubbed.path = scrubUrlSecrets(scrubbed.path);
  }
  if (typeof scrubbed.query === 'string') {
    scrubbed.query = scrubQueryField(scrubbed.query);
  }

  // Proxy failures store `GET <original url>: <cause>` here. `url` is masked
  // at ingest; this copy is not, and the Pages artifact publishes it.
  for (const field of ['errorMessage', 'stackPreview', 'componentStackPreview'] as const) {
    if (typeof scrubbed[field] === 'string') {
      scrubbed[field] = scrubFreeText(scrubbed[field]);
    }
  }

  return scrubbed;
}
