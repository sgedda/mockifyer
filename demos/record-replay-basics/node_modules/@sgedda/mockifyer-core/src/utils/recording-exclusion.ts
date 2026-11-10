import type { MockifyerConfig, RecordingExclusion } from '../types';

/**
 * Resolves a full URL string for recording checks when the client URL may be relative.
 * Absolute URLs (`https://…`) resolve without base; relative paths need `baseUrl`.
 */
export function resolveOutboundUrl(
  rawUrl: string | null | undefined,
  baseUrl?: string | null
): string | null {
  const raw = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!raw) {
    return null;
  }
  const base = typeof baseUrl === 'string' ? baseUrl.trim() : '';
  try {
    if (base !== '' || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw)) {
      return base !== '' ? new URL(raw, base).href : new URL(raw).href;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizePathnameSegment(pathname: string): string {
  if (!pathname) {
    return '/';
  }
  const withLeading = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (withLeading.length > 1 && withLeading.endsWith('/')) {
    return withLeading.slice(0, -1) || '/';
  }
  return withLeading;
}

function normalizePathPrefix(prefix?: string): string | null {
  if (prefix == null) {
    return null;
  }
  const trimmed = typeof prefix === 'string' ? prefix.trim() : '';
  if (!trimmed) {
    return null;
  }
  return normalizePathnameSegment(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
}

function pathMatches(normalizedPathname: string, pathPrefix?: string): boolean {
  const prefix = normalizePathPrefix(pathPrefix);
  if (prefix === null || prefix === '/') {
    return true;
  }
  if (normalizedPathname === prefix) {
    return true;
  }
  return normalizedPathname.startsWith(`${prefix}/`);
}

/** Strip optional scheme and anything after hostname (for accidental URLs in env). */
function sanitizeHostPiece(hostRaw: string): string {
  const first = hostRaw.trim().replace(/^https?:\/\//i, '').split('/')[0] ?? '';
  let h = first.trim().toLowerCase();
  h = h.replace(/^\.+|\.+$/g, '');
  return h;
}

function hostMatches(hostname: string, ruleHostRaw: string): boolean {
  const ruleHost = sanitizeHostPiece(ruleHostRaw);
  if (!ruleHost || !hostname) {
    return false;
  }
  const h = hostname.toLowerCase();
  if (h === ruleHost) {
    return true;
  }
  return h.endsWith(`.${ruleHost}`);
}

function sanitizeRecordingExclusions(rules: RecordingExclusion[]): RecordingExclusion[] {
  return rules
    .filter((rule) => rule && typeof rule.host === 'string' && sanitizeHostPiece(rule.host) !== '')
    .map((rule) => {
      const host = sanitizeHostPiece(rule.host);
      const pp = typeof rule.pathPrefix === 'string' ? rule.pathPrefix.trim() : '';
      const out: RecordingExclusion = { host };
      if (pp) {
        out.pathPrefix = pp.startsWith('/') ? pp : `/${pp}`;
      }
      return out;
    });
}

/**
 * Parses hierarchical recording exclusions from environment (Node / dashboard server).
 *
 * - `MOCKIFYER_RECORDING_EXCLUSIONS` — JSON array: `[{"host":"example.com","pathPrefix":"/api/private"}]`
 * - `MOCKIFYER_RECORDING_EXCLUSION_HOSTS` — comma-separated hostnames. `example.com` matches that host plus any subdomain (`api.example.com`); omit `pathPrefix` to disable recording for the whole host tree under the rule host.
 */
export function parseRecordingExclusionsEnv(): RecordingExclusion[] {
  if (typeof process === 'undefined' || !process.env) {
    return [];
  }

  const out: RecordingExclusion[] = [];
  const jsonRaw =
    typeof process.env.MOCKIFYER_RECORDING_EXCLUSIONS === 'string'
      ? process.env.MOCKIFYER_RECORDING_EXCLUSIONS.trim()
      : '';

  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).host === 'string') {
            const o = item as { host: string; pathPrefix?: unknown };
            out.push({
              host: o.host,
              pathPrefix: typeof o.pathPrefix === 'string' ? o.pathPrefix : undefined,
            });
          }
        }
      }
    } catch {
      // Invalid JSON — ignore.
    }
  }

  const hostsCsv =
    typeof process.env.MOCKIFYER_RECORDING_EXCLUSION_HOSTS === 'string'
      ? process.env.MOCKIFYER_RECORDING_EXCLUSION_HOSTS.trim()
      : '';
  if (hostsCsv) {
    for (const part of hostsCsv.split(',')) {
      const piece = part.trim();
      if (piece) {
        out.push({ host: piece });
      }
    }
  }

  return sanitizeRecordingExclusions(out);
}

/**
 * Combines exclusions from {@link MockifyerConfig.recordingExclusions} and env (when available).
 */
export function resolveRecordingExclusions(
  config?: Pick<MockifyerConfig, 'recordingExclusions'>
): RecordingExclusion[] {
  const fromConfig =
    Array.isArray(config?.recordingExclusions) && config.recordingExclusions.length > 0
      ? [...config.recordingExclusions]
      : [];
  const fromEnv = parseRecordingExclusionsEnv();
  if (!fromEnv.length) {
    return sanitizeRecordingExclusions(fromConfig);
  }
  return sanitizeRecordingExclusions([...fromConfig, ...fromEnv]);
}

/**
 * When true, outbound responses must not be persisted for this URL (recording only; mock replay behaves as before).
 *
 * @param rawUrl — Request URL from the interceptor (possibly relative — pass `baseUrl` from client config when needed).
 */
export function shouldExcludeRecording(
  rawUrl: string | null | undefined,
  exclusions: RecordingExclusion[],
  baseUrl?: string | null
): boolean {
  if (!Array.isArray(exclusions) || exclusions.length === 0) {
    return false;
  }
  const resolved = resolveOutboundUrl(rawUrl, baseUrl);
  if (!resolved) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(resolved);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = normalizePathnameSegment(parsed.pathname);

  return exclusions.some(
    (rule) => hostMatches(hostname, rule.host) && pathMatches(pathname, rule.pathPrefix)
  );
}
