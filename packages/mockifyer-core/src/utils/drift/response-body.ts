/**
 * Read a live drift-check response into the same shape Mockifyer stores.
 * Axios parses JSON bodies even when the media type is `application/vnd.*+json`.
 * Comparing or saving those bodies as raw text reports a false object→string
 * break and, on accept, replaces the mock object with a string.
 */

import {
  captureReadableStreamChunks,
  detectStreamKind,
  resolveStreamRecordCaps,
  type StreamRecordCaps,
} from '../stream-response';

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
  body?: ReadableStream<Uint8Array> | null;
}

function parseDriftTextBody(text: string, contentType: string | null): unknown {
  if (!isJsonResponseContentType(contentType)) {
    return text;
  }
  const normalized = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
  try {
    return JSON.parse(normalized);
  } catch {
    return text;
  }
}

/**
 * Parse a live response body. JSON media types (including `+json`) are parsed.
 * A byte-order mark is stripped before parse. Invalid JSON is returned as text.
 */
export async function readDriftResponseBody(response: DriftResponseLike): Promise<unknown> {
  const text = await response.text();
  return parseDriftTextBody(text, response.headers.get('content-type'));
}

export interface ReadDriftStreamBodyOptions extends StreamRecordCaps {
  /**
   * When true (or when the response looks like SSE/chunked), read with byte/duration
   * caps instead of awaiting `response.text()` (which never returns for open SSE).
   */
  forceCapped?: boolean;
}

/**
 * Read a live body for drift. For stream-like responses (or when `forceCapped`),
 * consume with the same byte/duration caps used when recording so never-ending
 * SSE endpoints do not hang the drift check.
 */
export async function readDriftResponseBodyMaybeCapped(
  response: DriftResponseLike,
  options?: ReadDriftStreamBodyOptions
): Promise<unknown> {
  const kind = detectStreamKind(response.headers) ?? (options?.forceCapped ? 'sse' : null);
  if (!kind) {
    return readDriftResponseBody(response);
  }

  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    // No stream body available — fall back to text with an AbortSignal if the
    // caller already raced a timeout; otherwise best-effort text().
    return readDriftResponseBody(response);
  }

  const caps = resolveStreamRecordCaps(options);
  const captured = await captureReadableStreamChunks(body, kind, caps);
  return parseDriftTextBody(captured.concatenated, response.headers.get('content-type'));
}
