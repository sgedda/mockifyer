/**
 * Record / replay helpers for streaming HTTP bodies (SSE and chunked bytes).
 * Keeps {@link StoredResponse.data} as the concatenated body for backward compatibility.
 */

import type {
  StreamKind,
  StreamReplayMode,
  StoredResponseStream,
  StoredStreamChunk,
} from '../types';

/** Default max UTF-8 bytes captured while recording a stream. */
export const DEFAULT_STREAM_RECORD_MAX_BYTES = 1_000_000;

/** Default max wall-clock ms captured while recording a stream. */
export const DEFAULT_STREAM_RECORD_MAX_DURATION_MS = 30_000;

/** Default replay pacing for stream mocks. */
export const DEFAULT_STREAM_REPLAY: StreamReplayMode = 'accelerated';

/** Cap total paced wait under `accelerated` (after first-chunk delay). */
export const ACCELERATED_STREAM_MAX_TOTAL_MS = 2_000;

const TEXT_DECODER_FATAL = false;

/**
 * True when this runtime can put a `ReadableStream` in a `Response` body
 * (Node 18+ / modern browsers). React Native often lacks this — callers should
 * fall back to flat body replay when false.
 */
export function supportsReadableStreamBody(): boolean {
  try {
    return typeof ReadableStream !== 'undefined' && typeof Response !== 'undefined';
  } catch {
    return false;
  }
}

/** Headers bag: Fetch Headers, plain record, or a minimal `{ get }` (drift tests). */
export type StreamHeaderSource =
  | Headers
  | Record<string, string>
  | { get(name: string): string | null }
  | undefined;

function headerMapGet(headers: StreamHeaderSource, name: string): string {
  if (!headers) {
    return '';
  }
  const lower = name.toLowerCase();
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return String((headers as { get(name: string): string | null }).get(name) ?? '');
  }
  const record = headers as Record<string, string>;
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lower) {
      return String(value ?? '');
    }
  }
  return '';
}

/**
 * Content types that are almost always fully buffered (even when Transfer-Encoding
 * is chunked — Node's `http.Server` often omits Content-Length for JSON).
 */
function isLikelyBufferedContentType(contentType: string): boolean {
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!mediaType) {
    return false;
  }
  if (mediaType === 'application/json' || mediaType.endsWith('+json')) {
    return true;
  }
  if (
    mediaType === 'text/html' ||
    mediaType === 'text/css' ||
    mediaType === 'text/javascript' ||
    mediaType === 'application/javascript' ||
    mediaType === 'application/xhtml+xml' ||
    mediaType === 'application/xml' ||
    mediaType === 'text/xml' ||
    mediaType === 'application/x-www-form-urlencoded' ||
    mediaType === 'multipart/form-data'
  ) {
    return true;
  }
  return false;
}

/**
 * Detect whether a response should be recorded/replayed as a stream.
 * - `text/event-stream` → SSE
 * - chunked body without Content-Length, and not a typical buffered media type → bytes
 *
 * Plain JSON (including chunked Node responses with `Content-Type: application/json`)
 * is not treated as a stream even though `response.body` is always a ReadableStream.
 */
export function detectStreamKind(headers: StreamHeaderSource): StreamKind | null {
  const contentType = headerMapGet(headers, 'content-type').toLowerCase();
  if (contentType.includes('text/event-stream')) {
    return 'sse';
  }
  const transferEncoding = headerMapGet(headers, 'transfer-encoding').toLowerCase();
  const contentLength = headerMapGet(headers, 'content-length').trim();
  if (
    transferEncoding.includes('chunked') &&
    contentLength === '' &&
    !isLikelyBufferedContentType(contentType)
  ) {
    return 'bytes';
  }
  return null;
}

export interface StreamRecordCaps {
  maxBytes?: number;
  maxDurationMs?: number;
}

export interface CapturedStreamRecording {
  stream: StoredResponseStream;
  /** Concatenated chunk text (same as {@link StoredResponse.data} for stream mocks). */
  concatenated: string;
}

/**
 * Resolve recording caps from config-like values with defaults.
 */
export function resolveStreamRecordCaps(caps?: StreamRecordCaps): {
  maxBytes: number;
  maxDurationMs: number;
} {
  const maxBytes =
    typeof caps?.maxBytes === 'number' && caps.maxBytes > 0
      ? caps.maxBytes
      : DEFAULT_STREAM_RECORD_MAX_BYTES;
  const maxDurationMs =
    typeof caps?.maxDurationMs === 'number' && caps.maxDurationMs > 0
      ? caps.maxDurationMs
      : DEFAULT_STREAM_RECORD_MAX_DURATION_MS;
  return { maxBytes, maxDurationMs };
}

/**
 * Resolve replay mode with default `accelerated`.
 */
export function resolveStreamReplayMode(mode?: StreamReplayMode | null): StreamReplayMode {
  if (mode === 'original' || mode === 'accelerated' || mode === 'immediate') {
    return mode;
  }
  return DEFAULT_STREAM_REPLAY;
}

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).byteLength;
  }
  // Fallback approximate (Node without TextEncoder is rare for this path)
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Consume a ReadableStream, timestamping chunks until EOF or caps.
 * Does not tee — call with the recording branch after `body.tee()`.
 */
export async function captureReadableStreamChunks(
  readable: ReadableStream<Uint8Array>,
  kind: StreamKind,
  caps?: StreamRecordCaps
): Promise<CapturedStreamRecording> {
  const { maxBytes, maxDurationMs } = resolveStreamRecordCaps(caps);
  const reader = readable.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: TEXT_DECODER_FATAL });
  const chunks: StoredStreamChunk[] = [];
  const startedAt = Date.now();
  let firstChunkAt: number | null = null;
  let totalBytes = 0;
  let truncated = false;
  let concatenated = '';

  try {
    while (true) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= maxDurationMs) {
        truncated = true;
        try {
          await reader.cancel('mockifyer-stream-duration-cap');
        } catch {
          // ignore cancel errors
        }
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value || value.byteLength === 0) {
        continue;
      }

      const now = Date.now();
      if (firstChunkAt === null) {
        firstChunkAt = now;
      }
      const text = decoder.decode(value, { stream: true });
      if (!text) {
        continue;
      }

      const chunkBytes = utf8ByteLength(text);
      if (totalBytes + chunkBytes > maxBytes) {
        const remaining = Math.max(0, maxBytes - totalBytes);
        const sliced = sliceUtf8ToMaxBytes(text, remaining);
        if (sliced) {
          chunks.push({
            offsetMs: Math.max(0, now - firstChunkAt),
            data: sliced,
          });
          concatenated += sliced;
          totalBytes += utf8ByteLength(sliced);
        }
        truncated = true;
        try {
          await reader.cancel('mockifyer-stream-byte-cap');
        } catch {
          // ignore
        }
        break;
      }

      chunks.push({
        offsetMs: Math.max(0, now - firstChunkAt),
        data: text,
      });
      concatenated += text;
      totalBytes += chunkBytes;
    }

    const flush = decoder.decode();
    if (flush && !truncated) {
      const flushBytes = utf8ByteLength(flush);
      if (totalBytes + flushBytes <= maxBytes) {
        const now = Date.now();
        if (firstChunkAt === null) {
          firstChunkAt = now;
        }
        chunks.push({
          offsetMs: Math.max(0, now - firstChunkAt),
          data: flush,
        });
        concatenated += flush;
      } else {
        truncated = true;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }

  const firstChunkDelayMs =
    firstChunkAt !== null ? Math.max(0, firstChunkAt - startedAt) : undefined;

  return {
    concatenated,
    stream: {
      kind,
      chunks,
      ...(firstChunkDelayMs !== undefined ? { firstChunkDelayMs } : {}),
      ...(truncated ? { truncated: true } : {}),
    },
  };
}

function sliceUtf8ToMaxBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) {
    return '';
  }
  if (utf8ByteLength(text) <= maxBytes) {
    return text;
  }
  if (typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined') {
    const encoded = new TextEncoder().encode(text);
    const sliced = encoded.slice(0, maxBytes);
    return new TextDecoder('utf-8', { fatal: false }).decode(sliced);
  }
  return text.slice(0, maxBytes);
}

/**
 * Tee a fetch response body: live branch for the caller, record branch for capture.
 * Returns null when the body cannot be teed (no body / no ReadableStream).
 */
export function teeResponseBodyForRecording(
  body: ReadableStream<Uint8Array> | null | undefined
): { live: ReadableStream<Uint8Array>; record: ReadableStream<Uint8Array> } | null {
  if (!body || typeof body.tee !== 'function') {
    return null;
  }
  try {
    const [live, record] = body.tee();
    return { live, record };
  } catch {
    return null;
  }
}

export interface ReplayDelayPlan {
  firstChunkDelayMs: number;
  /** Delay before emitting chunk i, relative to previous emit (chunk 0 uses firstChunkDelayMs separately). */
  interChunkDelayMs: number[];
}

/**
 * Build paced delays for stream replay modes.
 */
export function planStreamReplayDelays(
  stream: StoredResponseStream,
  mode: StreamReplayMode = DEFAULT_STREAM_REPLAY
): ReplayDelayPlan {
  const resolved = resolveStreamReplayMode(mode);
  const chunks = stream.chunks ?? [];
  const firstChunkDelayMs = Math.max(0, stream.firstChunkDelayMs ?? 0);

  if (chunks.length === 0) {
    return { firstChunkDelayMs: 0, interChunkDelayMs: [] };
  }

  if (resolved === 'immediate') {
    return {
      firstChunkDelayMs: 0,
      interChunkDelayMs: chunks.map(() => 0),
    };
  }

  const rawInter: number[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prev = i === 0 ? 0 : chunks[i - 1]!.offsetMs;
    rawInter.push(Math.max(0, chunks[i]!.offsetMs - prev));
  }

  if (resolved === 'original') {
    return { firstChunkDelayMs, interChunkDelayMs: rawInter };
  }

  // accelerated: keep relative spacing but compress total paced wait
  const chunkSpan = rawInter.reduce((sum, d) => sum + d, 0);
  const totalOriginal = firstChunkDelayMs + chunkSpan;
  if (totalOriginal <= ACCELERATED_STREAM_MAX_TOTAL_MS || totalOriginal === 0) {
    return { firstChunkDelayMs, interChunkDelayMs: rawInter };
  }
  const scale = ACCELERATED_STREAM_MAX_TOTAL_MS / totalOriginal;
  return {
    firstChunkDelayMs: Math.round(firstChunkDelayMs * scale),
    interChunkDelayMs: rawInter.map((d) => Math.round(d * scale)),
  };
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a ReadableStream that emits stored chunks according to {@link StreamReplayMode}.
 */
export function createReplayReadableStream(
  stream: StoredResponseStream,
  mode: StreamReplayMode = DEFAULT_STREAM_REPLAY
): ReadableStream<Uint8Array> {
  const plan = planStreamReplayDelays(stream, mode);
  const chunks = stream.chunks ?? [];
  const encoder = new TextEncoder();
  let index = 0;
  let started = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        await delay(plan.firstChunkDelayMs);
      }
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      // interChunkDelayMs[i] is the wait before emitting chunk i (after the previous chunk).
      if (index > 0) {
        await delay(plan.interChunkDelayMs[index] ?? 0);
      }
      const chunk = chunks[index]!;
      index += 1;
      controller.enqueue(encoder.encode(chunk.data));
      if (index >= chunks.length) {
        controller.close();
      }
    },
    cancel() {
      index = chunks.length;
    },
  });
}

/**
 * Compact summary of a stored stream for MCP / AI context (avoids dumping huge bodies).
 */
export function summarizeStoredStream(stream: StoredResponseStream): {
  kind: StreamKind;
  chunkCount: number;
  truncated: boolean;
  firstChunkDelayMs: number;
  totalDurationMs: number;
  totalBytes: number;
  events: Array<{ offsetMs: number; bytes: number; preview: string }>;
} {
  const chunks = stream.chunks ?? [];
  const events = chunks.map((chunk) => ({
    offsetMs: chunk.offsetMs,
    bytes: utf8ByteLength(chunk.data),
    preview: chunk.data.length > 80 ? `${chunk.data.slice(0, 80)}…` : chunk.data,
  }));
  const totalDurationMs =
    chunks.length === 0 ? 0 : chunks[chunks.length - 1]!.offsetMs + (stream.firstChunkDelayMs ?? 0);
  const totalBytes = events.reduce((sum, e) => sum + e.bytes, 0);
  return {
    kind: stream.kind,
    chunkCount: chunks.length,
    truncated: stream.truncated === true,
    firstChunkDelayMs: stream.firstChunkDelayMs ?? 0,
    totalDurationMs,
    totalBytes,
    events,
  };
}

/**
 * Replace a huge `response.data` string with a short marker when a stream timeline exists.
 * Used by MCP `get_mock` so agents get timing without the full concatenated dump.
 */
export function projectMockForMcp(mockLike: unknown): unknown {
  if (!mockLike || typeof mockLike !== 'object') {
    return mockLike;
  }
  const root = mockLike as Record<string, unknown>;
  // Shape: { filename, data: MockData } or MockData itself
  const dataNode =
    root.data && typeof root.data === 'object' && (root.data as Record<string, unknown>).response
      ? (root.data as Record<string, unknown>)
      : root;
  const response = (dataNode as { response?: Record<string, unknown> }).response;
  if (!response || typeof response !== 'object') {
    return mockLike;
  }
  const stream = response.stream as StoredResponseStream | undefined;
  if (!stream || !Array.isArray(stream.chunks)) {
    return mockLike;
  }
  const summary = summarizeStoredStream(stream);
  const projectedResponse = {
    ...response,
    data: `[stream:${summary.kind} chunks=${summary.chunkCount} bytes=${summary.totalBytes}${
      summary.truncated ? ' truncated' : ''
    }]`,
    streamSummary: summary,
  };
  if (dataNode === root) {
    return { ...root, response: projectedResponse };
  }
  return {
    ...root,
    data: {
      ...dataNode,
      response: projectedResponse,
    },
  };
}
