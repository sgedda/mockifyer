import { MockData } from '../types';
import { sha256Hex, utf8ByteLength } from './crypto-digest';

/**
 * Linux `NAME_MAX`. `writeFileSync` throws `ENAMETOOLONG` when any path
 * component is longer than this, which fails the in-flight request on fetch
 * (the save is awaited) and drops the recording on axios.
 */
export const MAX_FILE_NAME_BYTES = 255;

/**
 * Truncate UTF-8 text to at most `maxBytes` without appending a marker.
 * {@link truncateUtf8} adds a suffix that would push a filename back over the limit.
 */
function truncateUtf8ToBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) {
    return '';
  }
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= maxBytes) {
    return text;
  }
  let end = maxBytes;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return new TextDecoder().decode(bytes.slice(0, end));
}

/**
 * Keep one directory entry within {@link MAX_FILE_NAME_BYTES}.
 * A hash suffix preserves uniqueness when two long segments share a prefix.
 */
function clampFsPathSegment(segment: string): string {
  if (utf8ByteLength(segment) <= MAX_FILE_NAME_BYTES) {
    return segment;
  }
  const suffix = `_${sha256Hex(segment).slice(0, 10)}`;
  const budget = MAX_FILE_NAME_BYTES - utf8ByteLength(suffix);
  return `${truncateUtf8ToBytes(segment, budget)}${suffix}`;
}

/**
 * Keep a flat recording filename within {@link MAX_FILE_NAME_BYTES}.
 * Names that already fit are returned unchanged. Over-long names keep a prefix
 * plus a hash of `uniquenessKey` so distinct URLs do not overwrite one file.
 */
export function clampRecordingFilename(filename: string, uniquenessKey: string): string {
  if (utf8ByteLength(filename) <= MAX_FILE_NAME_BYTES) {
    return filename;
  }
  const digest = sha256Hex(uniquenessKey).slice(0, 16);
  const suffix = `_${digest}.json`;
  const stem = filename.endsWith('.json') ? filename.slice(0, -'.json'.length) : filename;
  const budget = MAX_FILE_NAME_BYTES - utf8ByteLength(suffix);
  if (budget <= 0) {
    const fallback = `${digest}.json`;
    return utf8ByteLength(fallback) <= MAX_FILE_NAME_BYTES
      ? fallback
      : digest.slice(0, MAX_FILE_NAME_BYTES);
  }
  return `${truncateUtf8ToBytes(stem, budget)}${suffix}`;
}

/**
 * Computes a structured { dir, filename } for saving a mock file.
 *
 * Directory structure (relative to scenario root):
 *   {hostname}/graphql/{operationName}.json        ← GraphQL (/graphql endpoint)
 *   {hostname}/rest/{path…}/{method}[_{id}].json   ← REST  (/rest/… endpoint)
 *   {hostname}/{path…}/{method}.json               ← everything else
 *
 * The filename is kept short: {dateStr}_{METHOD}[_{identifier}].json
 */
export function getMockFilePath(
  mockData: MockData,
  dateStr: string
): { dir: string; filename: string } {
  const url = mockData.request.url || '';
  const method = (mockData.request.method || 'GET').toUpperCase();

  let host = 'unknown';
  let pathSegments: string[] = [];

  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    pathSegments = parsed.pathname.split('/').filter(Boolean);
  } catch {
    // fallback: use raw URL slug
    const urlSafe = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_');
    return { dir: 'unknown', filename: `${method}_${urlSafe.substring(0, 60)}_${dateStr}.json` };
  }

  // Sanitize hostname (keep dots so it reads like a domain)
  const hostSafe = clampFsPathSegment(host.replace(/[^a-zA-Z0-9.-]/g, '_'));

  // Detect type and remaining path segments
  const graphqlIdx = pathSegments.lastIndexOf('graphql');
  const restIdx = pathSegments.indexOf('rest');

  let type: string;
  let remainingSegments: string[];

  if (graphqlIdx >= 0) {
    type = 'graphql';
    remainingSegments = pathSegments.slice(graphqlIdx + 1); // usually empty
  } else if (restIdx >= 0) {
    type = 'rest';
    remainingSegments = pathSegments.slice(restIdx + 1);
  } else {
    type = '';
    remainingSegments = pathSegments;
  }

  // Build short identifier from request body
  let identifier = '';
  if (mockData.request.data) {
    try {
      const body =
        typeof mockData.request.data === 'string'
          ? JSON.parse(mockData.request.data)
          : mockData.request.data;

      if (body.operationName) {
        identifier = body.operationName;
      } else if (body.path) {
        identifier = body.path;
      } else if (body.webAppName) {
        identifier = body.webAppName;
      }
    } catch {
      // ignore
    }
  }

  // Sanitize identifier
  identifier = identifier.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);

  const dirParts = [hostSafe, type, ...remainingSegments.map(clampFsPathSegment)].filter(Boolean);
  const dir = dirParts.join('/');
  const filename = identifier
    ? `${method}_${identifier}_${dateStr}.json`
    : `${method}_${dateStr}.json`;

  return { dir, filename };
}

/**
 * Formats a Date into the standard Mockifyer dateStr used in filenames.
 */
export function formatDateStr(date: Date = new Date()): string {
  return date
    .toISOString()
    .replace(/T/, '_')
    .replace(/\..+/, '')
    .replace(/:/g, '-');
}
