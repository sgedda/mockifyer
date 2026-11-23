/**
 * Unit tests for stream record/replay (#563).
 */

import type { StoredResponseStream } from '../packages/mockifyer-core/src/types';
import {
  ACCELERATED_STREAM_MAX_TOTAL_MS,
  captureReadableStreamChunks,
  createReplayReadableStream,
  detectStreamKind,
  planStreamReplayDelays,
  projectMockForMcp,
  resolveStreamReplayMode,
  summarizeStoredStream,
  supportsReadableStreamBody,
  teeResponseBodyForRecording,
} from '../packages/mockifyer-core/src/utils/stream-response';
import { bodyInitForFetchResponse } from '../packages/mockifyer-fetch/src/utils/fetch-response-body';
import { readDriftResponseBodyMaybeCapped } from '../packages/mockifyer-core/src/utils/drift/response-body';

function encodeChunks(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= parts.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(parts[i]!));
      i += 1;
    },
  });
}

async function readAllText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

async function readChunksWithTiming(
  stream: ReadableStream<Uint8Array>
): Promise<Array<{ data: string; atMs: number }>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const started = Date.now();
  const result: Array<{ data: string; atMs: number }> = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      result.push({
        data: decoder.decode(value, { stream: true }),
        atMs: Date.now() - started,
      });
    }
  }
  return result;
}

describe('detectStreamKind', () => {
  it('detects SSE from content-type', () => {
    expect(detectStreamKind({ 'content-type': 'text/event-stream' })).toBe('sse');
    expect(
      detectStreamKind({ 'Content-Type': 'text/event-stream; charset=utf-8' })
    ).toBe('sse');
  });

  it('detects chunked bytes without content-length for non-JSON types', () => {
    expect(detectStreamKind({ 'transfer-encoding': 'chunked' })).toBe('bytes');
    expect(
      detectStreamKind({
        'transfer-encoding': 'chunked',
        'content-type': 'application/octet-stream',
      })
    ).toBe('bytes');
  });

  it('does not treat chunked JSON (typical Node http) as a stream', () => {
    expect(
      detectStreamKind({
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
      })
    ).toBeNull();
  });

  it('does not treat fixed-length JSON as a stream', () => {
    expect(
      detectStreamKind({
        'content-type': 'application/json',
        'content-length': '12',
      })
    ).toBeNull();
  });
});

describe('captureReadableStreamChunks', () => {
  it('timestamps chunks and concatenates the body', async () => {
    const readable = encodeChunks(['hello ', 'world']);
    const captured = await captureReadableStreamChunks(readable, 'bytes');
    expect(captured.concatenated).toBe('hello world');
    expect(captured.stream.kind).toBe('bytes');
    expect(captured.stream.chunks.length).toBeGreaterThanOrEqual(1);
    expect(captured.stream.chunks.map((c) => c.data).join('')).toBe('hello world');
    expect(captured.stream.truncated).toBeUndefined();
  });

  it('respects byte cap and marks truncated', async () => {
    const readable = encodeChunks(['abcdef', 'ghijkl']);
    const captured = await captureReadableStreamChunks(readable, 'sse', {
      maxBytes: 4,
      maxDurationMs: 30_000,
    });
    expect(captured.concatenated.length).toBeLessThanOrEqual(4);
    expect(captured.stream.truncated).toBe(true);
  });

  it('respects duration cap and marks truncated', async () => {
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('a'));
        await new Promise((r) => setTimeout(r, 50));
        controller.enqueue(encoder.encode('b'));
        await new Promise((r) => setTimeout(r, 50));
        controller.enqueue(encoder.encode('c'));
        controller.close();
      },
    });
    const captured = await captureReadableStreamChunks(readable, 'sse', {
      maxBytes: 1_000_000,
      maxDurationMs: 40,
    });
    expect(captured.stream.truncated).toBe(true);
    expect(captured.concatenated.length).toBeGreaterThan(0);
  });

  it('tees so the live branch still receives all data', async () => {
    const source = encodeChunks(['one', 'two', 'three']);
    const teed = teeResponseBodyForRecording(source);
    expect(teed).not.toBeNull();
    const [liveText, captured] = await Promise.all([
      readAllText(teed!.live),
      captureReadableStreamChunks(teed!.record, 'bytes'),
    ]);
    expect(liveText).toBe('onetwothree');
    expect(captured.concatenated).toBe('onetwothree');
  });
});

describe('stream replay modes', () => {
  const stream: StoredResponseStream = {
    kind: 'sse',
    firstChunkDelayMs: 100,
    chunks: [
      { offsetMs: 0, data: 'a' },
      { offsetMs: 1000, data: 'b' },
      { offsetMs: 5000, data: 'c' },
    ],
  };

  it('defaults to accelerated', () => {
    expect(resolveStreamReplayMode(undefined)).toBe('accelerated');
  });

  it('plans immediate with zero delays', () => {
    const plan = planStreamReplayDelays(stream, 'immediate');
    expect(plan.firstChunkDelayMs).toBe(0);
    expect(plan.interChunkDelayMs.every((d) => d === 0)).toBe(true);
  });

  it('plans original delays from offsets', () => {
    const plan = planStreamReplayDelays(stream, 'original');
    expect(plan.firstChunkDelayMs).toBe(100);
    expect(plan.interChunkDelayMs).toEqual([0, 1000, 4000]);
  });

  it('compresses accelerated timelines', () => {
    const plan = planStreamReplayDelays(stream, 'accelerated');
    const total =
      plan.firstChunkDelayMs + plan.interChunkDelayMs.reduce((s, d) => s + d, 0);
    expect(total).toBeLessThanOrEqual(ACCELERATED_STREAM_MAX_TOTAL_MS);
  });

  it('replays immediate as concatenated body via ReadableStream', async () => {
    const body = createReplayReadableStream(stream, 'immediate');
    expect(await readAllText(body)).toBe('abc');
  });

  it('paces original mode with measurable gaps', async () => {
    const short: StoredResponseStream = {
      kind: 'bytes',
      firstChunkDelayMs: 0,
      chunks: [
        { offsetMs: 0, data: 'x' },
        { offsetMs: 80, data: 'y' },
      ],
    };
    const timed = await readChunksWithTiming(createReplayReadableStream(short, 'original'));
    expect(timed.map((t) => t.data).join('')).toBe('xy');
    if (timed.length >= 2) {
      expect(timed[1]!.atMs).toBeGreaterThanOrEqual(50);
    }
  });
});

describe('bodyInitForFetchResponse with stream', () => {
  it('rebuilds a ReadableStream when stream metadata is present', async () => {
    const stream: StoredResponseStream = {
      kind: 'sse',
      chunks: [
        { offsetMs: 0, data: 'event: ping\n' },
        { offsetMs: 10, data: 'data: 1\n\n' },
      ],
    };
    const init = bodyInitForFetchResponse(200, 'event: ping\ndata: 1\n\n', {
      stream,
      streamReplay: 'immediate',
    });
    expect(init).toBeInstanceOf(ReadableStream);
    const response = new Response(init, { status: 200 });
    expect(await response.text()).toBe('event: ping\ndata: 1\n\n');
  });

  it('keeps flat-body behaviour for mocks without stream', () => {
    expect(bodyInitForFetchResponse(200, { a: 1 })).toBe('{"a":1}');
    expect(bodyInitForFetchResponse(200, 'plain')).toBe('plain');
  });

  it('passes through a live ReadableStream as data', async () => {
    const live = encodeChunks(['live']);
    const init = bodyInitForFetchResponse(200, live);
    expect(init).toBe(live);
    expect(await readAllText(init as ReadableStream<Uint8Array>)).toBe('live');
  });
});

describe('backward compatibility', () => {
  it('supportsReadableStreamBody is true in Node test env', () => {
    expect(supportsReadableStreamBody()).toBe(true);
  });

  it('projectMockForMcp summarises stream mocks without dumping the body', () => {
    const mock = {
      filename: 'sse.json',
      data: {
        request: { method: 'GET', url: 'https://example.com/sse', headers: {} },
        response: {
          status: 200,
          data: 'event: a\ndata: huge-payload-here\n\n'.repeat(50),
          headers: { 'content-type': 'text/event-stream' },
          stream: {
            kind: 'sse' as const,
            chunks: [
              { offsetMs: 0, data: 'event: a\ndata: 1\n\n' },
              { offsetMs: 100, data: 'event: a\ndata: 2\n\n' },
            ],
            firstChunkDelayMs: 5,
          },
        },
        timestamp: new Date().toISOString(),
      },
    };
    const projected = projectMockForMcp(mock) as typeof mock & {
      data: { response: { data: string; streamSummary: { chunkCount: number } } };
    };
    expect(String(projected.data.response.data)).toMatch(/^\[stream:sse/);
    expect(projected.data.response.streamSummary.chunkCount).toBe(2);
    expect(summarizeStoredStream(mock.data.response.stream).totalBytes).toBeGreaterThan(0);
  });

  it('projectMockForMcp leaves non-stream mocks unchanged', () => {
    const mock = {
      filename: 'ok.json',
      data: {
        request: { method: 'GET', url: 'https://example.com', headers: {} },
        response: { status: 200, data: { ok: true }, headers: {} },
        timestamp: new Date().toISOString(),
      },
    };
    expect(projectMockForMcp(mock)).toEqual(mock);
  });
});

describe('drift capped stream read', () => {
  it('reads a never-ending SSE with a cap instead of hanging', async () => {
    const encoder = new TextEncoder();
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (cancelled) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode('data: tick\n\n'));
        await new Promise((r) => setTimeout(r, 5));
      },
      cancel() {
        cancelled = true;
      },
    });

    const response = {
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'text/event-stream' : null;
        },
      },
      body: endless,
      text: async () => {
        throw new Error('text() should not be used for capped stream reads');
      },
    };

    const body = await readDriftResponseBodyMaybeCapped(response, {
      forceCapped: true,
      maxBytes: 40,
      maxDurationMs: 200,
    });
    expect(typeof body).toBe('string');
    expect(String(body).length).toBeGreaterThan(0);
    expect(String(body).length).toBeLessThanOrEqual(40);
  });
});
