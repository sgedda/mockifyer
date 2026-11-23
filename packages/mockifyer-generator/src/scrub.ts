/**
 * Secret / PII scrubbing for generated mocks.
 *
 * Logic adapted from `e2e/lib/scrub-public-atlas.ts` (Atlas publish boundary)
 * so this package does not depend on mockifyer-core or the e2e tree.
 * Keep behaviour aligned when updating either copy.
 */

const SECRET_PARAM_EXACT = new Set(['key', 'auth', 'authorization', 'signature', 'sig']);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * True when a query-parameter or header name is a credential.
 * Hyphens and underscores are treated the same (`api-key` and `api_key`).
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

/** Redact secret query parameters and URL userinfo anywhere in a string. */
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

export function scrubHeaders(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = isSecretHeaderName(name)
      ? redactHeaderValue(name, value)
      : scrubFreeText(String(value ?? ''));
  }
  return out;
}

function isSecretObjectKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return (
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
  );
}

/**
 * Redact token-like strings and secret-named fields (Atlas `scrubObjectSecrets`).
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
      if (isSecretObjectKey(key)) {
        result[key] = '<redacted>';
      } else {
        result[key] = scrubObjectSecrets(value);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Collect sensitive literal values from a sample so generated output can be
 * checked / rewritten to never echo them (emails, long tokens, raw secrets).
 */
export function collectSensitiveLiterals(value: unknown, out = new Set<string>()): Set<string> {
  if (value === null || value === undefined) return out;

  if (typeof value === 'string') {
    if (value.length === 0) return out;
    for (const match of value.match(EMAIL_RE) ?? []) {
      if (match.length >= 3) out.add(match);
    }
    if (value.length > 30 && /^[A-Za-z0-9+/=_.-]{30,}$/.test(value)) {
      out.add(value);
    }
    if (/^(Bearer|Basic|OAuth|Digest)\s+\S+/i.test(value)) {
      const token = value.replace(/^(Bearer|Basic|OAuth|Digest)\s+/i, '').trim();
      if (token) out.add(token);
      out.add(value);
    }
    return out;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectSensitiveLiterals(item, out);
    return out;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretObjectKey(key) && typeof child === 'string' && child.length > 0) {
        out.add(child);
      }
      collectSensitiveLiterals(child, out);
    }
  }

  return out;
}

function scrubStringAgainstLiterals(text: string, literals: ReadonlySet<string>): string {
  let out = scrubFreeText(text);
  // Longest first so overlapping tokens redact correctly
  const sorted = [...literals].sort((a, b) => b.length - a.length);
  for (const lit of sorted) {
    if (!lit || lit === '<redacted>') continue;
    if (out.includes(lit)) {
      out = out.split(lit).join('<redacted>');
    }
  }
  // Any remaining emails → redacted (sample PII)
  out = out.replace(EMAIL_RE, '<redacted-email>');
  return out;
}

function isHeadersKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower === 'headers' ||
    lower.endsWith('headers') ||
    lower === 'requestheaders' ||
    lower === 'responseheaders'
  );
}

/**
 * Deep scrub: Atlas field/header rules + forbid echoing sample secret/PII literals.
 * Header maps use {@link scrubHeaders} (preserves `Bearer <redacted>`).
 */
export function scrubValue(value: unknown, forbiddenLiterals?: ReadonlySet<string>): unknown {
  const literals = forbiddenLiterals ?? collectSensitiveLiterals(value);

  const walk = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      const scrubbed = scrubStringAgainstLiterals(obj, literals);
      if (scrubbed !== obj) return scrubbed;
      if (obj.length > 30 && /^[A-Za-z0-9+/=_.-]{30,}$/.test(obj)) {
        return '<redacted>';
      }
      return scrubbed;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => walk(item));
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(obj as Record<string, unknown>)) {
        if (
          typeof child === 'object' &&
          child !== null &&
          !Array.isArray(child) &&
          isHeadersKey(key)
        ) {
          // Prefer Atlas header scrub (scheme-preserving) over blanket key redaction
          result[key] = scrubHeaders(child as Record<string, unknown>);
        } else if (isSecretObjectKey(key)) {
          result[key] = '<redacted>';
        } else {
          result[key] = walk(child);
        }
      }
      return result;
    }

    return obj;
  };

  return walk(value);
}

/**
 * Assert that none of `forbidden` appear in the JSON serialization of `value`.
 * Returns the list of leaks found (empty = clean).
 */
export function findSecretLeaks(value: unknown, forbidden: ReadonlySet<string>): string[] {
  const json = JSON.stringify(value);
  const leaks: string[] = [];
  for (const lit of forbidden) {
    if (!lit || lit === '<redacted>' || lit === '<redacted-email>') continue;
    if (json.includes(lit)) {
      leaks.push(lit);
    }
  }
  return leaks;
}
