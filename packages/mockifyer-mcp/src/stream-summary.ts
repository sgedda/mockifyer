/**
 * Summarise recorded stream timelines for MCP tool output so agents do not
 * receive huge concatenated SSE/chunk bodies from `get_mock`.
 */

interface StreamChunk {
  offsetMs?: number;
  data?: string;
}

interface StoredStream {
  kind?: string;
  chunks?: StreamChunk[];
  firstChunkDelayMs?: number;
  truncated?: boolean;
}

function previewText(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function summarizeStream(stream: StoredStream) {
  const chunks = Array.isArray(stream.chunks) ? stream.chunks : [];
  const events = chunks.map((chunk) => {
    const data = typeof chunk.data === 'string' ? chunk.data : '';
    return {
      offsetMs: typeof chunk.offsetMs === 'number' ? chunk.offsetMs : 0,
      bytes: data.length,
      preview: previewText(data),
    };
  });
  const lastOffset = events.length > 0 ? events[events.length - 1]!.offsetMs : 0;
  const firstChunkDelayMs =
    typeof stream.firstChunkDelayMs === 'number' ? stream.firstChunkDelayMs : 0;
  return {
    kind: stream.kind ?? 'bytes',
    chunkCount: chunks.length,
    truncated: stream.truncated === true,
    firstChunkDelayMs,
    totalDurationMs: lastOffset + firstChunkDelayMs,
    totalBytes: events.reduce((sum, e) => sum + e.bytes, 0),
    events,
  };
}

/**
 * Replace huge `response.data` with a short marker when `response.stream` exists.
 * Accepts `{ filename, data: MockData }` or a bare MockData-shaped object.
 */
export function projectMockForMcp(mockLike: unknown): unknown {
  if (!mockLike || typeof mockLike !== 'object') {
    return mockLike;
  }
  const root = mockLike as Record<string, unknown>;
  const dataNode =
    root.data && typeof root.data === 'object' && (root.data as Record<string, unknown>).response
      ? (root.data as Record<string, unknown>)
      : root;
  const response = (dataNode as { response?: Record<string, unknown> }).response;
  if (!response || typeof response !== 'object') {
    return mockLike;
  }
  const stream = response.stream as StoredStream | undefined;
  if (!stream || !Array.isArray(stream.chunks)) {
    return mockLike;
  }
  const summary = summarizeStream(stream);
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
