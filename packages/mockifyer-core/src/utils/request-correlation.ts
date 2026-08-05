import { ENV_VARS } from '../types';
import { randomEventId } from './crypto-digest';
import { getOutboundHeaderValue } from './outbound-header';
import { MOCKIFYER_CLIENT_ID_HEADER, getOutboundMockifyerClientIdHeader } from './activation-mode';
import {
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  installInlineTraceBodyWrapper,
  isIncludeInlineTraceBodiesRequested,
  isIncludeInlineTraceRequested,
} from './inline-trace';
import {
  getActiveInboundClientId,
  getActiveMockifyerHopContext,
  getActiveRequestCorrelation,
  runWithMockifyerHopContext,
  type MockifyerHopContext,
  type RequestCorrelationContext,
} from './hop-context';
export type {
  InlineTraceHopBufferItem,
  MockifyerHopContext,
  RequestCorrelationContext,
} from './hop-context';
export {
  getActiveInboundClientId,
  getActiveMockifyerHopContext,
  getActiveRequestCorrelation,
  runWithMockifyerHopContext,
  runWithRequestCorrelation,
} from './hop-context';

/** Outbound hop id — propagated to downstream services and the dashboard. */
export const MOCKIFYER_REQUEST_ID_HEADER = 'x-mockifyer-request-id';

/** Caller hop id — links this outbound request to the request that triggered it. */
export const MOCKIFYER_PARENT_REQUEST_ID_HEADER = 'x-mockifyer-parent-request-id';

/**
 * Property stamped on thrown/rejected errors so debuggers can look up
 * `/api/network-events/trace?requestId=…` without digging through response headers.
 */
export const MOCKIFYER_REQUEST_ID_ERROR_PROP = 'mockifyerRequestId' as const;

/** Express/Connect request field used to survive ALS gaps in error middleware. */
export const MOCKIFYER_REQUEST_ID_REQ_PROP = 'mockifyerRequestId' as const;

export function getMockifyerRequestIdFromError(error: unknown): string | undefined {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
    return undefined;
  }
  const value = (error as Record<string, unknown>)[MOCKIFYER_REQUEST_ID_ERROR_PROP];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Prefer the active inbound trace id (dashboard entry key), then a response header echo,
 * then the outbound hop id stashed on the HTTP client config.
 */
export function resolveMockifyerRequestIdForError(options: {
  hopRequestId?: string;
  responseHeaders?: unknown;
  requestId?: string;
} = {}): string | undefined {
  const explicit = options.requestId?.trim();
  if (explicit) {
    return explicit;
  }
  const active = getActiveRequestCorrelation()?.requestId?.trim();
  if (active) {
    return active;
  }
  const fromHeaders = getOutboundMockifyerRequestIdHeader(options.responseHeaders)?.trim();
  if (fromHeaders) {
    return fromHeaders;
  }
  const hop = options.hopRequestId?.trim();
  return hop || undefined;
}

export interface AttachMockifyerRequestIdToErrorOptions {
  /**
   * When true (default), append `[mockifyerRequestId=…]` to `Error.message` so the id
   * is visible in logs and test failure output without inspecting properties.
   */
  appendToMessage?: boolean;
}

/**
 * Stamps {@link MOCKIFYER_REQUEST_ID_ERROR_PROP} onto an error so thrown failures
 * carry the id to use with the dashboard network trace API.
 */
export function attachMockifyerRequestIdToError<T>(
  error: T,
  requestId?: string,
  options: AttachMockifyerRequestIdToErrorOptions = {}
): T {
  const id = resolveMockifyerRequestIdForError({ requestId });
  if (!id || error == null || (typeof error !== 'object' && typeof error !== 'function')) {
    return error;
  }

  const target = error as Record<string, unknown>;
  const existing =
    typeof target[MOCKIFYER_REQUEST_ID_ERROR_PROP] === 'string'
      ? String(target[MOCKIFYER_REQUEST_ID_ERROR_PROP]).trim()
      : '';
  if (!existing) {
    try {
      Object.defineProperty(target, MOCKIFYER_REQUEST_ID_ERROR_PROP, {
        value: id,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } catch {
      try {
        target[MOCKIFYER_REQUEST_ID_ERROR_PROP] = id;
      } catch {
        // non-extensible / frozen
      }
    }
  }

  const effectiveId = existing || id;
  const appendToMessage = options.appendToMessage !== false;
  if (appendToMessage && error instanceof Error) {
    const marker = `[${MOCKIFYER_REQUEST_ID_ERROR_PROP}=${effectiveId}]`;
    if (!error.message.includes(`[${MOCKIFYER_REQUEST_ID_ERROR_PROP}=`)) {
      try {
        error.message = error.message ? `${error.message} ${marker}` : marker;
      } catch {
        // message may be read-only
      }
    }
  }

  return error;
}

function isEnvFlagDisabled(raw: string | undefined): boolean {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  return value === '0' || value === 'false' || value === 'off' || value === 'no';
}

/**
 * Whether Node inbound capture should echo/assign `X-Mockifyer-Request-Id` on responses.
 * Default **true**. Disable with {@link ENV_VARS.MOCK_ECHO_TRACE_ID}=false.
 */
export function isMockifyerEchoTraceIdEnabled(
  env: NodeJS.ProcessEnv = typeof process !== 'undefined' ? process.env : {}
): boolean {
  return !isEnvFlagDisabled(env[ENV_VARS.MOCK_ECHO_TRACE_ID]);
}

/**
 * Whether {@link installNodeInboundRequestCorrelationCapture} should install.
 * Default **true**. Disable with {@link ENV_VARS.MOCK_AUTO_INBOUND_CORRELATION}=false.
 */
export function isMockifyerAutoInboundCorrelationEnabled(
  env: NodeJS.ProcessEnv = typeof process !== 'undefined' ? process.env : {}
): boolean {
  return !isEnvFlagDisabled(env[ENV_VARS.MOCK_AUTO_INBOUND_CORRELATION]);
}

export function newRequestCorrelationId(): string {
  return randomEventId();
}

export function getOutboundMockifyerRequestIdHeader(headers: unknown): string | undefined {
  return getOutboundHeaderValue(headers, MOCKIFYER_REQUEST_ID_HEADER);
}

export function getOutboundMockifyerParentRequestIdHeader(headers: unknown): string | undefined {
  return getOutboundHeaderValue(headers, MOCKIFYER_PARENT_REQUEST_ID_HEADER);
}

/**
 * Reads inbound Mockifyer headers (lane + optional request correlation).
 */
export function captureInboundMockifyerContext(headers: unknown): MockifyerHopContext | undefined {
  const inboundClientId = getOutboundMockifyerClientIdHeader(headers);
  const requestId = getOutboundMockifyerRequestIdHeader(headers);
  const parentRequestId = getOutboundMockifyerParentRequestIdHeader(headers);
  if (!inboundClientId && !requestId) {
    return undefined;
  }
  const correlation = requestId
    ? parentRequestId
      ? { requestId, parentRequestId }
      : { requestId }
    : undefined;
  return { inboundClientId, correlation };
}

/**
 * Builds hop context for an inbound HTTP request (optional assign when the trace id is missing).
 */
export function resolveInboundHopContext(
  headers: unknown,
  options: {
    assignInboundTraceIdWhenMissing?: boolean;
    /** Collect outbound hops for an inline response-body trace (test/debug). */
    includeInlineTrace?: boolean;
    includeInlineTraceBodies?: boolean;
  } = {}
): { ctx: MockifyerHopContext; traceId?: string } | undefined {
  const includeInlineTrace = options.includeInlineTrace === true;
  const includeInlineTraceBodies = options.includeInlineTraceBodies === true;
  const assignInboundTraceIdWhenMissing =
    options.assignInboundTraceIdWhenMissing !== false || includeInlineTrace;
  const captured = captureInboundMockifyerContext(headers);

  let traceId = captured?.correlation?.requestId;
  if (!traceId && assignInboundTraceIdWhenMissing) {
    traceId = newRequestCorrelationId();
  }

  if (!traceId && !captured?.inboundClientId && !includeInlineTrace) {
    return undefined;
  }

  const ctx: MockifyerHopContext = {
    inboundClientId: captured?.inboundClientId,
    correlation: traceId
      ? captured?.correlation?.parentRequestId
        ? { requestId: traceId, parentRequestId: captured.correlation.parentRequestId }
        : { requestId: traceId }
      : captured?.correlation,
    ...(includeInlineTrace
      ? {
          includeInlineTrace: true,
          includeInlineTraceBodies,
          inlineHops: [],
        }
      : {}),
  };

  return { ctx, traceId };
}

function maybeEchoTraceIdOnResponse(
  res: { setHeader?: (name: string, value: string) => void } | undefined,
  traceId: string | undefined,
  echoEnabled: boolean
): void {
  if (!echoEnabled || !traceId || typeof res?.setHeader !== 'function') {
    return;
  }
  res.setHeader(MOCKIFYER_REQUEST_ID_HEADER, traceId);
}

/**
 * Reads correlation from inbound HTTP headers (Express, fetch, axios).
 * @deprecated Prefer {@link captureInboundMockifyerContext} for lane + correlation.
 */
export function captureInboundRequestCorrelation(headers: unknown): RequestCorrelationContext | undefined {
  return captureInboundMockifyerContext(headers)?.correlation;
}

function setHeaderOnObject(headers: Record<string, unknown>, canonicalLower: string, value: string): void {
  let replaced = false;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === canonicalLower) {
      headers[key] = value;
      replaced = true;
    }
  }
  if (!replaced) {
    headers[canonicalLower] = value;
  }
}

function setOutboundHeader(headers: unknown, canonicalLower: string, value: string): unknown {
  if (!headers || typeof headers !== 'object') {
    return { [canonicalLower]: value };
  }

  const h = headers as Record<string, unknown> & {
    set?: (name: string, value: string) => void;
  };

  if (typeof h.set === 'function') {
    h.set(canonicalLower, value);
    return headers;
  }

  const next = { ...(headers as Record<string, unknown>) };
  setHeaderOnObject(next, canonicalLower, value);
  return next;
}

function removeOutboundHeader(headers: unknown, canonicalLower: string): unknown {
  if (!headers || typeof headers !== 'object') {
    return headers;
  }

  const h = headers as Record<string, unknown> & {
    delete?: (name: string) => void;
  };

  if (typeof h.delete === 'function') {
    h.delete(canonicalLower);
    return headers;
  }

  const next = { ...(headers as Record<string, unknown>) };
  for (const key of Object.keys(next)) {
    if (key.toLowerCase() === canonicalLower) {
      delete next[key];
    }
  }
  return next;
}

/**
 * Resolve parent for the next outbound hop:
 * 1. Active inbound correlation (Node auto-capture / Express middleware / ALS)
 * 2. Explicit `X-Mockifyer-Parent-Request-Id` on the outbound config
 */
export function resolveOutboundParentRequestId(headers: unknown): string | undefined {
  const active = getActiveRequestCorrelation()?.requestId;
  if (active) {
    return active;
  }
  return getOutboundMockifyerParentRequestIdHeader(headers);
}

function applyInboundClientIdToOutboundHeaders(config: { headers?: unknown }): void {
  const lane =
    getOutboundMockifyerClientIdHeader(config.headers) ?? getActiveInboundClientId();
  if (lane) {
    config.headers = setOutboundHeader(config.headers, MOCKIFYER_CLIENT_ID_HEADER, lane);
  }
}

/** Forward include-trace opt-in so downstream services can return nested mockifyerTrace. */
function applyOutboundInlineTraceHeaders(config: { headers?: unknown }): void {
  const ctx = getActiveMockifyerHopContext();
  if (!ctx?.includeInlineTrace) {
    return;
  }
  config.headers = setOutboundHeader(config.headers, MOCKIFYER_INCLUDE_TRACE_HEADER, '1');
  if (ctx.includeInlineTraceBodies) {
    config.headers = setOutboundHeader(
      config.headers,
      MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
      '1'
    );
  }
}

/**
 * Assigns hop ids on an outbound request and returns them for logging / mock metadata.
 * Strips any stale `X-Mockifyer-Request-Id` on the config so each hop gets a fresh id.
 * When the active request opted into inline trace, also forwards include-trace headers.
 */
export function applyOutboundRequestCorrelation(config: { headers?: unknown }): RequestCorrelationContext {
  applyInboundClientIdToOutboundHeaders(config);
  applyOutboundInlineTraceHeaders(config);
  const parentRequestId = resolveOutboundParentRequestId(config.headers);
  const requestId = newRequestCorrelationId();

  let headers = config.headers;
  headers = removeOutboundHeader(headers, MOCKIFYER_REQUEST_ID_HEADER);
  headers = setOutboundHeader(headers, MOCKIFYER_REQUEST_ID_HEADER, requestId);
  if (parentRequestId) {
    headers = setOutboundHeader(headers, MOCKIFYER_PARENT_REQUEST_ID_HEADER, parentRequestId);
  }
  config.headers = headers;

  return parentRequestId ? { requestId, parentRequestId } : { requestId };
}

export interface MockifyerCorrelationMiddlewareRequest {
  header(name: string): string | undefined;
  query?: unknown;
  url?: string;
  /** Set by {@link createMockifyerCorrelationMiddleware} for error handlers. */
  mockifyerRequestId?: string;
}

export interface MockifyerCorrelationMiddlewareResponse {
  setHeader?(name: string, value: string): void;
  headersSent?: boolean;
  json?(body: unknown): unknown;
  send?(body: unknown): unknown;
  status?(code: number): unknown;
  statusCode?: number;
}

export interface MockifyerCorrelationMiddlewareOptions {
  /**
   * When true, set `X-Mockifyer-Request-Id` on the HTTP response so clients can
   * call `/api/network-events/trace?requestId=…` after the request completes.
   * When omitted, follows {@link ENV_VARS.MOCK_ECHO_TRACE_ID} (default on).
   */
  echoTraceIdOnResponse?: boolean;
  /**
   * When true (default), assign a new inbound trace id when the request did not send one.
   */
  assignInboundTraceIdWhenMissing?: boolean;
}

export interface MockifyerErrorHandlerOptions {
  /**
   * When true, if headers are not sent yet, respond with JSON `{ error, requestId }`
   * (status from `err.status` / `err.statusCode` or 500).
   * Default **false** — only enrich the error, re-echo the response header, and `next(err)`.
   */
  sendJsonResponse?: boolean;
}

const NODE_INBOUND_CAPTURE_INSTALLED = Symbol.for(
  '@sgedda/mockifyer-core.nodeInboundCaptureInstalled'
);
const NODE_INBOUND_EMIT_PATCHED = Symbol.for('@sgedda/mockifyer-core.nodeInboundEmitPatched');

function isNodeInboundCaptureInstalled(): boolean {
  return Boolean(
    (globalThis as typeof globalThis & { [NODE_INBOUND_CAPTURE_INSTALLED]?: boolean })[
      NODE_INBOUND_CAPTURE_INSTALLED
    ]
  );
}

function markNodeInboundCaptureInstalled(): void {
  (globalThis as typeof globalThis & { [NODE_INBOUND_CAPTURE_INSTALLED]?: boolean })[
    NODE_INBOUND_CAPTURE_INSTALLED
  ] = true;
}

function patchNodeServerEmit(serverModule: { Server: new (...args: never[]) => unknown }): void {
  const prototype = serverModule.Server.prototype as {
    emit: ((event: string, ...args: unknown[]) => boolean) & {
      [NODE_INBOUND_EMIT_PATCHED]?: boolean;
    };
  };
  if (prototype.emit?.[NODE_INBOUND_EMIT_PATCHED]) {
    return;
  }
  const originalEmit = prototype.emit;

  const patchedServerEmit = function patchedServerEmit(
    this: unknown,
    event: string,
    ...args: unknown[]
  ): boolean {
    if (event === 'request') {
      const req = args[0] as { headers?: unknown; url?: string } | undefined;
      const res = args[1] as {
        setHeader?: (name: string, value: string) => void;
        json?: (body: unknown) => unknown;
        send?: (body: unknown) => unknown;
      } | undefined;
      const includeInlineTrace = isIncludeInlineTraceRequested({
        headers: req?.headers,
        url: req?.url,
      });
      const includeInlineTraceBodies = isIncludeInlineTraceBodiesRequested({
        headers: req?.headers,
        url: req?.url,
      });
      const resolved = req?.headers
        ? resolveInboundHopContext(req.headers, { includeInlineTrace, includeInlineTraceBodies })
        : includeInlineTrace
          ? resolveInboundHopContext({}, { includeInlineTrace, includeInlineTraceBodies })
          : undefined;
      if (resolved) {
        if (req && resolved.traceId) {
          (req as { [MOCKIFYER_REQUEST_ID_REQ_PROP]?: string })[MOCKIFYER_REQUEST_ID_REQ_PROP] =
            resolved.traceId;
        }
        maybeEchoTraceIdOnResponse(res, resolved.traceId, isMockifyerEchoTraceIdEnabled());
        return runWithMockifyerHopContext(resolved.ctx, () => {
          if (res) {
            installInlineTraceBodyWrapper(res);
          }
          try {
            return originalEmit.apply(this, [event, ...args]);
          } catch (error) {
            throw attachMockifyerRequestIdToError(error, resolved.traceId);
          }
        });
      }
    }
    return originalEmit.apply(this, [event, ...args]);
  };
  patchedServerEmit[NODE_INBOUND_EMIT_PATCHED] = true;
  prototype.emit = patchedServerEmit;
}

/**
 * Node.js only: wrap incoming `http(s).Server` requests so outbound Mockifyer calls inherit
 * inbound lane / trace ids without Express middleware. By default also assigns a trace id when
 * missing and echoes `X-Mockifyer-Request-Id` on the response
 * (disable echo with {@link ENV_VARS.MOCK_ECHO_TRACE_ID}=false).
 *
 * Installed once when `setupMockifyer` runs. Disable entirely with
 * {@link ENV_VARS.MOCK_AUTO_INBOUND_CORRELATION}=false.
 */
export function installNodeInboundRequestCorrelationCapture(): boolean {
  if (isNodeInboundCaptureInstalled()) {
    return true;
  }
  if (typeof process === 'undefined' || !process.versions?.node) {
    return false;
  }
  if (!isMockifyerAutoInboundCorrelationEnabled()) {
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const http = require('http') as typeof import('http');
    patchNodeServerEmit(http);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const https = require('https') as typeof import('https');
      patchNodeServerEmit(https);
    } catch {
      // https optional
    }
    markNodeInboundCaptureInstalled();
    return true;
  } catch {
    return false;
  }
}

/**
 * Express/Connect middleware: capture inbound lane + trace id for downstream Mockifyer hops.
 * By default assigns a trace id when missing and echoes it on the response header.
 */
export function createMockifyerCorrelationMiddleware(
  options: MockifyerCorrelationMiddlewareOptions = {}
): (
  req: MockifyerCorrelationMiddlewareRequest,
  res: MockifyerCorrelationMiddlewareResponse,
  next: () => void
) => void {
  const assignInboundTraceIdWhenMissing = options.assignInboundTraceIdWhenMissing !== false;

  return (req, res, next) => {
    const headerBag = {
      get: (name: string) => req.header(name),
    };
    const includeInlineTrace = isIncludeInlineTraceRequested({
      headers: headerBag,
      query: req.query,
      url: req.url,
    });
    const includeInlineTraceBodies = isIncludeInlineTraceBodiesRequested({
      headers: headerBag,
      query: req.query,
      url: req.url,
    });

    const resolved = resolveInboundHopContext(headerBag, {
      assignInboundTraceIdWhenMissing,
      includeInlineTrace,
      includeInlineTraceBodies,
    });

    if (!resolved) {
      next();
      return;
    }

    if (resolved.traceId) {
      req[MOCKIFYER_REQUEST_ID_REQ_PROP] = resolved.traceId;
    }

    const shouldEcho =
      options.echoTraceIdOnResponse !== undefined
        ? options.echoTraceIdOnResponse
        : isMockifyerEchoTraceIdEnabled();
    maybeEchoTraceIdOnResponse(res, resolved.traceId, shouldEcho);
    runWithMockifyerHopContext(resolved.ctx, () => {
      installInlineTraceBodyWrapper(res);
      try {
        next();
      } catch (error) {
        throw attachMockifyerRequestIdToError(error, resolved.traceId);
      }
    });
  };
}

function readErrorHttpStatus(error: unknown): number {
  if (!error || typeof error !== 'object') {
    return 500;
  }
  const e = error as { status?: unknown; statusCode?: unknown };
  const raw = e.status ?? e.statusCode;
  const status = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isInteger(status) && status >= 400 && status < 600) {
    return status;
  }
  return 500;
}

/**
 * Express error middleware: stamps {@link MOCKIFYER_REQUEST_ID_ERROR_PROP} on the error,
 * re-echoes `X-Mockifyer-Request-Id`, and optionally sends JSON that includes `requestId`
 * so clients/debuggers can open the dashboard trace without reading headers.
 *
 * Mount after routes: `app.use(createMockifyerErrorHandler())`.
 */
export function createMockifyerErrorHandler(
  options: MockifyerErrorHandlerOptions = {}
): (
  err: unknown,
  req: MockifyerCorrelationMiddlewareRequest,
  res: MockifyerCorrelationMiddlewareResponse,
  next: (err?: unknown) => void
) => void {
  const sendJsonResponse = options.sendJsonResponse === true;

  return (err, req, res, next) => {
    const requestId =
      (typeof req.mockifyerRequestId === 'string' && req.mockifyerRequestId.trim()
        ? req.mockifyerRequestId.trim()
        : undefined) ?? getActiveRequestCorrelation()?.requestId;
    const enriched = attachMockifyerRequestIdToError(err, requestId);
    maybeEchoTraceIdOnResponse(res, requestId, isMockifyerEchoTraceIdEnabled());

    if (!sendJsonResponse || res.headersSent) {
      next(enriched);
      return;
    }

    const status = readErrorHttpStatus(enriched);
    const message =
      enriched instanceof Error
        ? enriched.message
        : typeof enriched === 'string'
          ? enriched
          : 'Internal Server Error';

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      res.status(status);
      res.json({
        error: message,
        ...(requestId ? { requestId } : {}),
      });
      return;
    }

    if (typeof res.json === 'function') {
      res.statusCode = status;
      res.json({
        error: message,
        ...(requestId ? { requestId } : {}),
      });
      return;
    }

    next(enriched);
  };
}
