import { randomEventId } from './crypto-digest';
import { getOutboundHeaderValue } from './outbound-header';
import { isMockifyerDashboardPlumbingApiUrl } from './join-proxy-dashboard-api-url';
import type { NetworkEventSource, NetworkEventTransport } from './network-log';
import { toNetworkLogBodyPreview, emitMockifyerNetworkEvent } from './network-log';
import {
  getActiveMockifyerHopContext,
  type MockifyerHopContext,
} from './hop-context';

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

/**
 * Marks a response that already has json/send/end patched for inline trace.
 * Symbol.for so duplicate module copies still share the same key.
 */
const INLINE_TRACE_BODY_WRAPPER_INSTALLED = Symbol.for(
  '@sgedda/mockifyer-core.inlineTraceBodyWrapper'
);

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
  // Never surface the internal POST to dashboard `/api/proxy` as a user-visible hop.
  if (isMockifyerDashboardPlumbingApiUrl(input.url)) {
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

  const businessBody = getInlineTraceEnvelopeBusinessBody(params.responseBody);

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
      ? toNetworkLogBodyPreview(businessBody)
      : undefined,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readInlineTrace(body: Record<string, unknown>): InlineRequestTrace | null {
  const trace = body[MOCKIFYER_TRACE_RESPONSE_KEY];
  if (!isRecord(trace) || !Array.isArray(trace.hops)) {
    return null;
  }
  return trace as unknown as InlineRequestTrace;
}

/**
 * REST/HAL payloads often carry `_links` / tokens at the resource root. GraphQL
 * `data` is an operation map and should keep its `data` key after sibling unwrap.
 */
function isRestOrHalResourcePayload(data: Record<string, unknown>): boolean {
  if ('_links' in data || '_embedded' in data) {
    return true;
  }
  if ('authJwtToken' in data) {
    return true;
  }
  return 'token' in data && 'refreshToken' in data;
}

/**
 * Legacy wrap `{ data, mockifyerTrace }` with no other keys.
 * Object payloads now keep their own fields and only add `mockifyerTrace`.
 * Still peel when `data` looks like a REST/HAL resource (accidental wrap of member
 * authenticate, etc.) so clients that read `authJwtToken` at the top level keep working.
 */
function isPureInlineTraceEnvelope(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body);
  if (
    keys.length !== 2 ||
    !Object.prototype.hasOwnProperty.call(body, MOCKIFYER_TRACE_DATA_KEY) ||
    readInlineTrace(body) == null
  ) {
    return false;
  }
  const data = body[MOCKIFYER_TRACE_DATA_KEY];
  // Legacy envelopes wrap non-objects (arrays, scalars).
  if (!isRecord(data)) {
    return true;
  }
  // GraphQL `{ data, mockifyerTrace }` — keep `data`. REST/HAL accidental wraps — peel.
  return isRestOrHalResourcePayload(data);
}

/**
 * True when `body` is the legacy inline-trace envelope `{ data, mockifyerTrace }`.
 * GraphQL `{ data, mockifyerTrace }` (trace added beside the original fields) is not an envelope.
 */
export function isInlineTraceEnvelope(body: unknown): body is {
  data: unknown;
  mockifyerTrace: InlineRequestTrace;
} {
  return isRecord(body) && isPureInlineTraceEnvelope(body);
}

/**
 * Business payload with inline trace removed.
 * Pure envelopes yield `data`. Sibling traces yield the original object minus `mockifyerTrace`.
 */
export function getInlineTraceEnvelopeBusinessBody(body: unknown): unknown {
  if (!isRecord(body) || readInlineTrace(body) == null) {
    return body;
  }
  if (isPureInlineTraceEnvelope(body)) {
    return body[MOCKIFYER_TRACE_DATA_KEY];
  }
  const { [MOCKIFYER_TRACE_RESPONSE_KEY]: _removed, ...rest } = body;
  return rest;
}

/**
 * If `body` is a downstream inline-trace envelope, merge its hops into the active
 * in-process buffer and return the unwrapped business `data`. Otherwise returns `body`.
 */
export function unwrapAndMergeInlineTraceEnvelope(body: unknown): unknown {
  if (!isRecord(body) || readInlineTrace(body) == null) {
    return body;
  }

  const ctx = getActiveMockifyerHopContext();
  // Only unwrap when the parent request is collecting an inline trace (headers were forwarded).
  if (!ctx?.includeInlineTrace || !ctx.inlineHops) {
    return body;
  }

  const childHops = readInlineTrace(body)!.hops;
  for (const hop of childHops) {
    if (!hop || typeof hop !== 'object') continue;
    const url = typeof hop.url === 'string' ? hop.url : '';
    if (isMockifyerDashboardPlumbingApiUrl(url)) {
      continue;
    }
    recordInlineTraceHop({
      requestId: hop.requestId ?? null,
      parentRequestId: hop.parentRequestId ?? null,
      timestamp: typeof hop.timestamp === 'string' ? hop.timestamp : undefined,
      method: typeof hop.method === 'string' ? hop.method : 'GET',
      url,
      status: hop.status,
      source: (hop.source as NetworkEventSource) || 'upstream',
      durationMs: hop.durationMs,
      transport: (hop.transport as NetworkEventTransport) || 'proxy',
      clientId: hop.clientId,
      requestBodyPreview: hop.requestBodyPreview,
      responseBodyPreview: hop.responseBodyPreview,
      errorMessage: hop.errorMessage,
    });
  }

  return getInlineTraceEnvelopeBusinessBody(body);
}

export interface UnwrapInlineTraceEmittingNetworkEventsParams {
  /** Client hop id that triggered this response (fallback parent for nested hops). */
  parentRequestId: string;
  config: Parameters<typeof emitMockifyerNetworkEvent>[0]['config'];
  scenario?: string;
  clientId?: string;
  sessionId?: string;
  transport?: NetworkEventTransport;
}

/**
 * When the response carries `mockifyerTrace.hops`, emit each nested hop as a
 * {@link emitMockifyerNetworkEvent} (Metro stream + dashboard + Atlas HTML buffer) with
 * `parentRequestId`, then return the business payload. No-op when there is no inline trace.
 *
 * Used on RN/client when `networkLog.includeTraceHeader` requested nested traces without
 * an inbound ALS hop context.
 */
export function unwrapInlineTraceEnvelopeEmittingNetworkEvents(
  body: unknown,
  params: UnwrapInlineTraceEmittingNetworkEventsParams
): unknown {
  if (!isRecord(body) || readInlineTrace(body) == null) {
    return body;
  }

  const parentId = params.parentRequestId.trim();
  const hops = readInlineTrace(body)!.hops;
  for (const hop of hops) {
    if (!hop || typeof hop !== 'object') continue;
    const url = typeof hop.url === 'string' ? hop.url : '';
    if (!url || isMockifyerDashboardPlumbingApiUrl(url)) continue;

    const hopRequestId =
      typeof hop.requestId === 'string' && hop.requestId.trim() ? hop.requestId.trim() : null;
    // Skip duplicate of the client hop already logged by the interceptor.
    if (hopRequestId && parentId && hopRequestId === parentId) continue;

    const hopParent =
      (typeof hop.parentRequestId === 'string' && hop.parentRequestId.trim()
        ? hop.parentRequestId.trim()
        : null) ||
      (parentId || null);

    const method = typeof hop.method === 'string' && hop.method.trim() ? hop.method : 'GET';
    emitMockifyerNetworkEvent({
      config: params.config,
      scenario: params.scenario,
      clientId: params.clientId,
      sessionId: params.sessionId,
      event: {
        method,
        url,
        status: typeof hop.status === 'number' ? hop.status : undefined,
        source: (hop.source as NetworkEventSource) || 'upstream',
        transport: (hop.transport as NetworkEventTransport) || params.transport || 'proxy',
        durationMs: typeof hop.durationMs === 'number' ? hop.durationMs : undefined,
        requestId: hopRequestId,
        parentRequestId: hopParent,
        clientId:
          typeof hop.clientId === 'string' ? hop.clientId : params.clientId ?? null,
        errorMessage: typeof hop.errorMessage === 'string' ? hop.errorMessage : undefined,
        requestBodyPreview:
          typeof hop.requestBodyPreview === 'string' ? hop.requestBodyPreview : undefined,
        responseBodyPreview:
          typeof hop.responseBodyPreview === 'string' ? hop.responseBodyPreview : undefined,
      },
    });
  }

  // Also merge into ALS buffer when an inbound collector is active.
  unwrapAndMergeInlineTraceEnvelope(body);
  return getInlineTraceEnvelopeBusinessBody(body);
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
 * Attach `mockifyerTrace` without moving existing fields.
 * Object bodies keep their shape (`{ ...body, mockifyerTrace }`), so GraphQL `data`
 * stays where clients already read it. Arrays and scalars still use `{ data, mockifyerTrace }`.
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
  if (isRecord(body)) {
    return {
      ...body,
      [MOCKIFYER_TRACE_RESPONSE_KEY]: trace,
    };
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

/**
 * True when response headers were already flushed with a Content-Length.
 * Rewriting the body to a different size in that state truncates or hangs clients.
 */
function hasCommittedContentLength(res: InlineTraceHttpResponse): boolean {
  if (!res.headersSent) {
    return false;
  }
  const raw = res.getHeader?.('content-length');
  if (raw == null) {
    return false;
  }
  if (Array.isArray(raw)) {
    return raw.some((value) => String(value).length > 0);
  }
  return String(raw).length > 0;
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

  // Auto inbound capture + correlation middleware both call this on the same `res`.
  // A second install would chain another patchedEnd/json/send with its own onceWrap,
  // nesting Apollo-style res.end JSON envelopes.
  const marked = res as InlineTraceHttpResponse & {
    [INLINE_TRACE_BODY_WRAPPER_INSTALLED]?: boolean;
  };
  if (marked[INLINE_TRACE_BODY_WRAPPER_INSTALLED]) {
    return;
  }
  try {
    Object.defineProperty(res, INLINE_TRACE_BODY_WRAPPER_INSTALLED, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  } catch {
    // Still proceed; wrapBodyWithInlineTrace guards against nested envelopes.
  }

  let wrapped = false;
  const onceWrap = (body: unknown): unknown => {
    if (wrapped) return body;
    wrapped = true;
    return wrapBodyWithInlineTrace(body, ctx);
  };

  /**
   * Resolve json/send from the prototype chain (skipping own properties).
   * Node inbound capture installs before Express `setPrototypeOf(res, app.response)`,
   * so the real methods often appear only later — resolve at call time.
   */
  const resolvePrototypeMethod = (
    target: InlineTraceHttpResponse,
    name: 'json' | 'send'
  ): ((body: unknown) => unknown) | undefined => {
    try {
      let proto: object | null = Object.getPrototypeOf(target) as object | null;
      while (proto && proto !== Object.prototype) {
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        if (desc) {
          if (typeof desc.value === 'function') {
            return desc.value as (body: unknown) => unknown;
          }
          break;
        }
        proto = Object.getPrototypeOf(proto) as object | null;
      }
    } catch {
      // ignore
    }
    return undefined;
  };

  /**
   * Install lazy own-property wrappers so same-tick Express `res.json` / `res.send`
   * (after setPrototypeOf, before any microtask) still get `mockifyerTrace`.
   * Avoid defineProperty getters that return undefined — those break `res.status().json`.
   */
  const installLazyMethod = (name: 'json' | 'send'): void => {
    const desc = Object.getOwnPropertyDescriptor(res, name);
    if (desc && desc.writable === false) {
      return;
    }

    const priorOwn =
      desc && typeof desc.value === 'function'
        ? (desc.value as (body: unknown) => unknown)
        : undefined;

    const lazy = function lazyInlineTraceMethod(
      this: InlineTraceHttpResponse,
      body: unknown
    ): unknown {
      const target = this ?? res;
      const original =
        priorOwn ?? resolvePrototypeMethod(target, name);
      if (typeof original !== 'function') {
        throw new TypeError(`res.${name} is not a function`);
      }
      const bound = original.bind(target) as (body: unknown) => unknown;
      if (name === 'json') {
        return wrapJsonMethod(bound, onceWrap)(body);
      }
      return wrapSendMethod(target, bound, onceWrap)(body);
    };

    try {
      res[name] = lazy;
    } catch {
      // ignore non-configurable
    }
  };

  installLazyMethod('json');
  installLazyMethod('send');

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
          // Headers already flushed with Content-Length cannot be updated;
          // rewriting to a larger body would truncate or hang the client.
          if (hasCommittedContentLength(res)) {
            return originalEnd(chunk, encoding, cb);
          }

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
