/**
 * Fetch "null body status" codes — Response body must be null.
 * Passing '' / JSON (including JSON.stringify(null) → "null") throws in undici:
 * `TypeError: Response constructor: Invalid response status code 204`
 *
 * @see https://fetch.spec.whatwg.org/#null-body-status
 */

import type { StreamReplayMode, StoredResponseStream } from '@sgedda/mockifyer-core';
import {
  createReplayReadableStream,
  resolveStreamReplayMode,
  supportsReadableStreamBody,
} from '@sgedda/mockifyer-core';

const FETCH_NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/**
 * Whether `status` forbids a Response body under the Fetch spec.
 */
export function isFetchNullBodyStatus(status: number): boolean {
  return FETCH_NULL_BODY_STATUSES.has(status);
}

export interface BodyInitForFetchResponseOptions {
  /** Recorded stream timeline — when set (and ReadableStream is supported), rebuild a paced stream. */
  stream?: StoredResponseStream | null;
  /** Replay pacing; defaults to `accelerated`. */
  streamReplay?: StreamReplayMode | null;
}

/**
 * Body argument for `new Response(body, { status })`.
 * Returns `null` for null-body statuses so Node/undici does not throw.
 * When `data` is already a ReadableStream, it is returned as-is (live passthrough).
 * When `options.stream` is set and the runtime supports ReadableStream bodies,
 * returns a paced replay stream; otherwise falls back to the flat concatenated body.
 */
export function bodyInitForFetchResponse(
  status: number,
  data: unknown,
  options?: BodyInitForFetchResponseOptions
): BodyInit | null {
  if (isFetchNullBodyStatus(status)) {
    return null;
  }
  if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) {
    return data as BodyInit;
  }
  const storedStream = options?.stream;
  if (
    storedStream &&
    Array.isArray(storedStream.chunks) &&
    storedStream.chunks.length > 0 &&
    supportsReadableStreamBody()
  ) {
    return createReplayReadableStream(
      storedStream,
      resolveStreamReplayMode(options?.streamReplay)
    );
  }
  if (typeof data === 'string') {
    return data;
  }
  // JSON.stringify(undefined) is undefined — Response treats nullish as empty body
  if (data === undefined) {
    return null;
  }
  return JSON.stringify(data);
}
