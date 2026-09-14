/** Synthetic list/API name for Redis/SQLite-backed mocks: `redis/<64-hex>.json`. */
const REDIS_MOCK_FILENAME_PATTERN = /^redis\/([a-f0-9]{64})\.json$/i;

/**
 * Decode a mock filename captured from an Express `*` route.
 *
 * Dashboard UI leaves slashes in the path (`redis/<hash>.json`). Some clients
 * `encodeURIComponent` the whole name, turning `/` into `%2F`. Express may or
 * may not decode that before `req.params`.
 */
export function decodeMockFilenameParam(relativeName: string | undefined | null): string {
  if (!relativeName) return '';
  let value = relativeName;
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  return value;
}

/** Hash from `redis/<64-hex>.json` (optionally percent-encoded). */
export function parseRedisHashFromFilename(relativeName: string): string | null {
  const decoded = decodeMockFilenameParam(relativeName);
  const match = REDIS_MOCK_FILENAME_PATTERN.exec(decoded);
  return match?.[1] ?? null;
}

export const MOCK_FIELD_OVERRIDES_SUFFIX = '/field-overrides';

/**
 * If a catch-all mock path accidentally includes `/field-overrides`, return the
 * real mock filename. Atlas embeds the dashboard at `/mockifyer` and GETs
 * `.../redis/<hash>.json/field-overrides`.
 */
export function stripFieldOverridesSuffix(relativeName: string): string | null {
  const decoded = decodeMockFilenameParam(relativeName);
  if (!decoded.endsWith(MOCK_FIELD_OVERRIDES_SUFFIX)) return null;
  const filename = decoded.slice(0, -MOCK_FIELD_OVERRIDES_SUFFIX.length);
  return filename.length > 0 ? filename : null;
}
