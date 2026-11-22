/**
 * Parse upstream HTTP bodies the same way Axios does for JSON media types.
 * `application/json` and any `*+json` type (RFC 6839) become objects.
 * Leaving `application/problem+json` or `application/vnd.api+json` as text
 * makes `response.data.field` undefined and, on record or refresh, stores a
 * string in place of the object.
 */

const JSON_MEDIA_TYPE = 'application/json';
const JSON_STRUCTURED_SUFFIX = '+json';
const UTF8_BOM = '\uFEFF';

/**
 * True for `application/json` and any `*+json` media type, ignoring parameters
 * such as charset.
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

/**
 * Parse a response body when its media type is JSON. A byte-order mark is
 * stripped before parse. Invalid JSON and non-JSON media types stay text.
 */
export function parseUpstreamResponseBody(
  contentType: string | null | undefined,
  rawText: string
): unknown {
  if (!isJsonResponseContentType(contentType)) {
    return rawText;
  }
  const normalized = rawText.startsWith(UTF8_BOM) ? rawText.slice(UTF8_BOM.length) : rawText;
  try {
    return JSON.parse(normalized);
  } catch {
    return rawText;
  }
}
