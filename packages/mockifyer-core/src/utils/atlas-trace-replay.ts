/**
 * Re-call a captured Atlas hop with `X-Mockifyer-Include-Trace` so the response
 * carries `mockifyerTrace` (nested hops) for live debugging.
 */

import type { NetworkEvent } from './network-event-types';
import {
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_TRACE_RESPONSE_KEY,
} from './inline-trace';

export const ATLAS_TRACE_REPLAY_PATH = '/mockifyer-atlas-trace';

export interface AtlasTraceReplayResult {
  success: boolean;
  hopId: string;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  /** Parsed JSON body when content-type is JSON; otherwise truncated text. */
  body?: unknown;
  mockifyerTrace?: unknown;
  error?: string;
  /** Headers sent on the replay (excluding secrets when scrubbed later). */
  requestHeaders: Record<string, string>;
}

export interface ReplayNetworkEventWithIncludeTraceOptions {
  /** Also stamp include-trace-bodies. Default true. */
  includeBodies?: boolean;
  /** Override fetch (tests). */
  fetchFn?: typeof fetch;
  /** Extra headers merged after defaults (can override). */
  headers?: Record<string, string>;
  /** Max characters retained for non-JSON text bodies. Default 64_000. */
  maxTextChars?: number;
}

function findHop(
  events: readonly NetworkEvent[],
  hopId: string,
): NetworkEvent | undefined {
  const id = hopId.trim();
  if (!id) return undefined;
  return events.find(
    (e) => e && (e.id === id || e.requestId === id),
  );
}

/**
 * Locate a hop in a newest-first or chronological buffer and replay it with
 * the include-trace opt-in headers.
 */
export async function replayNetworkEventWithIncludeTrace(
  events: readonly NetworkEvent[],
  hopId: string,
  options?: ReplayNetworkEventWithIncludeTraceOptions,
): Promise<AtlasTraceReplayResult> {
  const event = findHop(events, hopId);
  if (!event) {
    return {
      success: false,
      hopId,
      method: '',
      url: '',
      error: 'hop not found',
      requestHeaders: {},
    };
  }

  const method = (event.method || 'GET').toUpperCase();
  const url = (event.url || '').trim();
  if (!url) {
    return {
      success: false,
      hopId: event.id,
      method,
      url: '',
      error: 'hop has no url',
      requestHeaders: {},
    };
  }

  const includeBodies = options?.includeBodies !== false;
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    [MOCKIFYER_INCLUDE_TRACE_HEADER]: '1',
  };
  if (includeBodies) {
    headers[MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER] = '1';
  }
  if (options?.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      if (v != null && String(v).trim() !== '') {
        headers[k] = String(v);
      }
    }
  }

  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    const body = event.requestBodyPreview;
    if (typeof body === 'string' && body.length > 0) {
      init.body = body;
      if (!headers['content-type'] && !headers['Content-Type']) {
        headers['content-type'] = looksLikeJson(body)
          ? 'application/json'
          : 'text/plain;charset=UTF-8';
      }
    }
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const started = Date.now();
  try {
    const res = await fetchFn(url, init);
    const durationMs = Date.now() - started;
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    let body: unknown = text;
    if (contentType.includes('json') || looksLikeJson(text)) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = truncateText(text, options?.maxTextChars);
      }
    } else {
      body = truncateText(text, options?.maxTextChars);
    }

    const mockifyerTrace = extractMockifyerTrace(body);

    return {
      success: true,
      hopId: event.id,
      method,
      url,
      status: res.status,
      durationMs,
      body,
      mockifyerTrace,
      requestHeaders: headers,
    };
  } catch (error) {
    return {
      success: false,
      hopId: event.id,
      method,
      url,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      requestHeaders: headers,
    };
  }
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  );
}

function truncateText(text: string, maxChars = 64_000): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n… [truncated ${text.length - maxChars} chars]`;
}

function extractMockifyerTrace(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  return record[MOCKIFYER_TRACE_RESPONSE_KEY];
}
