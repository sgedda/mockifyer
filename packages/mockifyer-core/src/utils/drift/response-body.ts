/**
 * Read a live drift-check response into the same shape Mockifyer stores.
 * Axios parses JSON bodies even when the media type is `application/vnd.*+json`.
 * Comparing or saving those bodies as raw text reports a false object→string
 * break and, on accept, replaces the mock object with a string.
 */

import { isJsonResponseContentType, parseUpstreamResponseBody } from '../json-response-body';

export { isJsonResponseContentType, parseUpstreamResponseBody };

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
  return parseUpstreamResponseBody(response.headers.get('content-type'), text);
}
