import { randomEventId } from './crypto-digest';
import { getOutboundHeaderValue } from './outbound-header';
import { toNetworkLogBodyPreview } from './network-log';
import type { NetworkEventSource, NetworkEventTransport } from './network-log';
import {
  getActiveMockifyerHopContext,
  type MockifyerHopContext,
} from './request-correlation';

/** Opt-in: include in-process hop trace on the HTTP response body (test/debug). */
export const MOCKIFYER_INCLUDE_TRACE_HEADER = 'x-mockifyer-include-trace';

/** Opt-in: include truncated request/response body previews on inline hops. */
export const MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER = 'x-mockifyer-include-trace-bodies';

/** Query alias for {@link MOCKIFYER_INCLUDE_TRACE_HEADER} (e.g. `?trace-mockifyer=true`). */
export const MOCKIFYER_INCLUDE_TRACE_QUERY = 'trace-mockifyer';

/** Top-level JSON key used when wrapping the business response. */
export const MOCKIFYER_TRACE_RESPONSE_KEY = 'mockifyerTrace';

/** Envelope key for the original body when wrapping. */
export const MOCKIFYER_TRACE_DATA_KEY = 'data';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function isTruthyFlag(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  return TRUTHY.has(String(raw).trim().toLowerCase());
}

export interface InlineTraceHop {
  index: number;
  requestId: string | null;
  parentRequestId: string | null;
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  source: NetworkEventSource;
  durationMs?: number;
  transport: NetworkEventTransport;
  clientId?: string | null;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  errorMessage?: string;
}

export interface InlineRequestTrace {
  requestId: string | null;
  hopCount: number;
  hops: InlineTraceHop[];
  /** Always false for in-process collection (no external store window). */
  incomplete: boolean;
}

export type RecordInlineTraceHopInput = Omit<InlineTraceHop, 'index' | 'timestamp'> & {
  timestamp?: string;
};

/**
 * Reads opt-in from headers (`X-Mockifyer-Include-Trace`) or query (`trace-mockifyer`).
 */
export function isIncludeInlineTraceRequested(input: {
  headers?: unknown;
  query?: unknown;
  url?: string;
}): boolean {
  if (isTruthyFlag(getOutboundHeaderValue(input.headers, MOCKIFYER_INCLUDE_TRACE_HEADER))) {
    return true;
  }
  const fromQuery = readQueryFlag(input.query, MOCKIFYER_INCLUDE_TRACE_QUERY);
  if (fromQuery) return true;
  return isTruthyFlag(readUrlQueryParam(input.url, MOCKIFYER_INCLUDE_TRACE_QUERY));
}

export function isIncludeInlineTraceBodiesRequested(input: {
  headers?: unknown;
  query?: unknown;
  url?: string;
}): boolean {
  if (isTruthyFlag(getOutboundHeaderValue(input.headers, MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER))) {
    return true;
  }
  const fromQuery = readQueryFlag(input.query, 'trace-mockifyer-bodies');
  if (fromQuery) return true;
  return isTruthyFlag(readUrlQueryParam(input.url, 'trace-mockifyer-bodies'));
}

function readQueryFlag(query: unknown, name: string): boolean {
  if (!query || typeof query !== 'object') return false;
  const q = query as Record<string, unknown>;
  const direct = q[name] ?? q[name.toLowerCase()];
  if (Array.isArray(direct)) {
    return direct.some((v) => isTruthyFlag(String(v)));
  }
  if (direct != null) return isTruthyFlag(String(direct));
  for (const [k, v] of Object.entries(q)) {
    if (k.toLowerCase() === name.toLowerCase()) {
      return isTruthyFlag(String(v));
    }
  }
  return false;
}

function readUrlQueryParam(url: string | undefined, name: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const qIndex = url.indexOf('?');
  if (qIndex < 0) return undefined;
  const search = url.slice(qIndex + 1).split('#')[0] ?? '';
  for (const part of search.split('&')) {
    if (!part) continue;
    const [rawKey, rawVal = ''] = part.split('=');
    let key = rawKey;
    let val = rawVal;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      val = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      // keep raw
    }
    if (key.toLowerCase() === name.toLowerCase()) {
      return val || 'true';
    }
  }
  return undefined;
}

/** Map dashboard proxy `source` strings onto network-event sources. */
export function mapProxyPayloadSourceToNetworkSource(source: string | undefined): NetworkEventSource {
  const s = String(source ?? '')
    .trim()
    .toLowerCase();
  if (s === 'redis' || s === 'disk' || s === 'mock' || s === 'mock-hit') return 'mock-hit';
  if (s === 'blocked' || s === 'blocked_strict_lane') return 'blocked';
  if (s === 'error') return 'error';
  if (s === 'miss' || s === 'mock-miss') return 'mock-miss';
  return 'upstream';
}

/**
 * Append one outbound hop to the active request-scoped inline trace buffer (no-op when not opted in).
 */
export function recordInlineTraceHop(input: RecordInlineTraceHopInput): void {
  const ctx = getActiveMockifyerHopContext();
  if (!ctx?.includeInlineTrace || !ctx.inlineHops) {
    return;
  }

  const hop: InlineTraceHop = {
    index: ctx.inlineHops.length,
    requestId: input.requestId,
    parentRequestId: input.parentRequestId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    method: input.method,
    url: input.url,
    status: input.status,
    source: input.source,
    durationMs: input.durationMs,
    transport: input.transport,
    clientId: input.clientId,
    errorMessage: input.errorMessage,
  };

  if (ctx.includeInlineTraceBodies) {
    hop.requestBodyPreview = input.requestBodyPreview;
    hop.responseBodyPreview = input.responseBodyPreview;
  }

  ctx.inlineHops.push(hop);
}

/**
 * Convenience: record a hop and optionally stringify body previews when bodies are enabled.
 */
export function recordInlineTraceHopFromExchange(params: {
  method: string;
  url: string;
  status?: number;
  source: NetworkEventSource;
  transport: NetworkEventTransport;
  requestId?: string | null;
  parentRequestId?: string | null;
  durationMs?: number;
  clientId?: string | null;
  requestBody?: unknown;
  responseBody?: unknown;
  errorMessage?: string;
}): void {
  const ctx = getActiveMockifyerHopContext();
  if (!ctx?.includeInlineTrace) return;

  recordInlineTraceHop({
    method: params.method,
    url: params.url,
    status: params.status,
    source: params.source,
    transport: params.transport,
    requestId: params.requestId ?? null,
    parentRequestId: params.parentRequestId ?? null,
    durationMs: params.durationMs,
    clientId: params.clientId,
    errorMessage: params.errorMessage,
    requestBodyPreview: ctx.includeInlineTraceBodies
      ? toNetworkLogBodyPreview(params.requestBody)
      : undefined,
    responseBodyPreview: ctx.includeInlineTraceBodies
      ? toNetworkLogBodyPreview(params.responseBody)
      : undefined,
  });
}

export function buildInlineRequestTrace(
  ctx: MockifyerHopContext | undefined = getActiveMockifyerHopContext()
): InlineRequestTrace | null {
  if (!ctx?.includeInlineTrace) {
    return null;
  }
  const hops: InlineTraceHop[] = [...(ctx.inlineHops ?? [])].map((h, index) => ({
    ...h,
    index,
    source: h.source as NetworkEventSource,
    transport: h.transport as NetworkEventTransport,
  }));
  return {
    requestId: ctx.correlation?.requestId ?? null,
    hopCount: hops.length,
    hops,
    incomplete: false,
  };
}

/**
 * Wrap a business response as `{ data, mockifyerTrace }` when inline trace is active.
 * Returns the original body when not opted in.
 */
export function wrapBodyWithInlineTrace(
  body: unknown,
  ctx: MockifyerHopContext | undefined = getActiveMockifyerHopContext()
): unknown {
  const trace = buildInlineRequestTrace(ctx);
  if (!trace) {
    return body;
  }
  return {
    [MOCKIFYER_TRACE_DATA_KEY]: body,
    [MOCKIFYER_TRACE_RESPONSE_KEY]: trace,
  };
}

function isNodeBuffer(value: unknown): boolean {
  return typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function' && Buffer.isBuffer(value);
}

function utf8ByteLength(value: string): number {
  if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
    return Buffer.byteLength(value);
  }
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

type InlineTraceHttpResponse = {
  json?: (body: unknown) => unknown;
  send?: (body: unknown) => unknown;
  end?: (...args: any[]) => any;
  setHeader?: (name: string, value: any) => void;
  getHeader?: (name: string) => number | string | string[] | undefined;
  headersSent?: boolean;
};

function looksLikeJsonPayload(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

function responseLooksJson(res: InlineTraceHttpResponse): boolean {
  const raw = res.getHeader?.('content-type');
  const contentType = Array.isArray(raw) ? raw.join(';') : String(raw ?? '');
  return contentType.toLowerCase().includes('json');
}

function wrapJsonMethod(
  original: (body: unknown) => unknown,
  onceWrap: (body: unknown) => unknown
): (body: unknown) => unknown {
  return (body: unknown) => original(onceWrap(body));
}

function wrapSendMethod(
  res: InlineTraceHttpResponse,
  originalSend: (body: unknown) => unknown,
  onceWrap: (body: unknown) => unknown
): (body: unknown) => unknown {
  return (body: unknown) => {
    if (body != null && typeof body === 'object' && !isNodeBuffer(body)) {
      return originalSend(onceWrap(body));
    }
    if (looksLikeJsonPayload(body)) {
      try {
        const parsed = JSON.parse(body) as unknown;
        const wrappedBody = onceWrap(parsed);
        if (typeof res.setHeader === 'function') {
          res.setHeader('content-type', 'application/json; charset=utf-8');
        }
        return originalSend(JSON.stringify(wrappedBody));
      } catch {
        return originalSend(body);
      }
    }
    return originalSend(body);
  };
}

/**
 * Patch HTTP/Express/Apollo responses so the final JSON body includes `mockifyerTrace`.
 *
 * Covers:
 * - Express `res.json` / `res.send` (including when Express assigns them *after* Node `request`)
 * - Apollo / raw Node that write JSON via `res.end(chunk)`
 *
 * No-op when the active hop context did not opt into inline trace.
 */
export function installInlineTraceBodyWrapper(res: InlineTraceHttpResponse): void {
  const ctx = getActiveMockifyerHopContext();
  if (!ctx?.includeInlineTrace) {
    return;
  }

  let wrapped = false;
  const onceWrap = (body: unknown): unknown => {
    if (wrapped) return body;
    wrapped = true;
    return wrapBodyWithInlineTrace(body, ctx);
  };

  const assignJson = (fn: (body: unknown) => unknown): void => {
    try {
      res.json = wrapJsonMethod(fn.bind(res), onceWrap);
    } catch {
      // ignore non-configurable
    }
  };
  const assignSend = (fn: (body: unknown) => unknown): void => {
    try {
      res.send = wrapSendMethod(res, fn.bind(res), onceWrap);
    } catch {
      // ignore non-configurable
    }
  };

  if (typeof res.json === 'function') {
    assignJson(res.json);
  } else {
    // Express adds `json` after the raw Node `request` event — intercept the assignment.
    try {
      Object.defineProperty(res, 'json', {
        configurable: true,
        enumerable: true,
        get() {
          return undefined;
        },
        set(fn: (body: unknown) => unknown) {
          Object.defineProperty(res, 'json', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: wrapJsonMethod(fn.bind(res), onceWrap),
          });
        },
      });
    } catch {
      // ignore
    }
  }

  if (typeof res.send === 'function') {
    assignSend(res.send);
  } else {
    try {
      Object.defineProperty(res, 'send', {
        configurable: true,
        enumerable: true,
        get() {
          return undefined;
        },
        set(fn: (body: unknown) => unknown) {
          Object.defineProperty(res, 'send', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: wrapSendMethod(res, fn.bind(res), onceWrap),
          });
        },
      });
    } catch {
      // ignore
    }
  }

  // Apollo Server expressMiddleware writes JSON through res.end — not res.json.
  if (typeof res.end === 'function') {
    const originalEnd = res.end.bind(res);
    res.end = function patchedEnd(this: unknown, chunk?: any, encoding?: any, cb?: any) {
      if (wrapped || chunk == null || chunk === '') {
        return originalEnd(chunk, encoding, cb);
      }

      let text: string | undefined;
      if (typeof chunk === 'string') {
        text = chunk;
      } else if (isNodeBuffer(chunk)) {
        const enc =
          typeof encoding === 'string' && encoding.length > 0 ? encoding : 'utf8';
        text = chunk.toString(enc as BufferEncoding);
      }

      if (text && (responseLooksJson(res) || looksLikeJsonPayload(text))) {
        try {
          const parsed = JSON.parse(text) as unknown;
          const wrappedBody = onceWrap(parsed);
          const out = JSON.stringify(wrappedBody);
          if (typeof res.setHeader === 'function' && !res.headersSent) {
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.setHeader('content-length', utf8ByteLength(out));
          }
          if (typeof encoding === 'function') {
            return originalEnd(out, encoding);
          }
          return originalEnd(out, encoding, cb);
        } catch {
          return originalEnd(chunk, encoding, cb);
        }
      }

      return originalEnd(chunk, encoding, cb);
    };
  }
}

/** @internal test helper */
export function newInlineTraceEventId(): string {
  return randomEventId();
}
