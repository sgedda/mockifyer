/**
 * Read a live drift-check response into the same shape Mockifyer stores.
 * Axios parses JSON bodies even when the media type is `application/vnd.*+json`.
 * Comparing or saving those bodies as raw text reports a false object→string
 * break and, on accept, replaces the mock object with a string.
 */

const JSON_MEDIA_TYPE = 'application/json';
const JSON_STRUCTURED_SUFFIX = '+json';
const UTF8_BOM = '\uFEFF';

/**
 * True for `application/json` and any `*+json` media type (RFC 6839),
 * ignoring parameters such as charset.
 */
export function isJsonResponseContentType(contentType: string | null | undefined): boolean {
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!mediaType) {
    return false;
  }
  return mediaType === JSON_MEDIA_TYPE || mediaType.endsWith(JSON_STRUCTURED_SUFFIX);
}

interface DriftResponseLike {
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/**
 * Parse a live response body. JSON media types (including `+json`) are parsed.
 * A byte-order mark is stripped before parse. Invalid JSON is returned as text.
 */
export async function readDriftResponseBody(response: DriftResponseLike): Promise<unknown> {
  const text = await response.text();
  if (!isJsonResponseContentType(response.headers.get('content-type'))) {
    return text;
  }
  const normalized = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
  try {
    return JSON.parse(normalized);
  } catch {
    return text;
  }
}
