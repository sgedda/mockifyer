import { ENV_VARS } from '../types';
import { randomEventId } from './crypto-digest';
import { getOutboundHeaderValue } from './outbound-header';
import { MOCKIFYER_CLIENT_ID_HEADER, getOutboundMockifyerClientIdHeader } from './activation-mode';
import {
  getActiveInboundClientId,
  getActiveRequestCorrelation,
  runWithMockifyerHopContext,
  type MockifyerHopContext,
  type RequestCorrelationContext,
} from './hop-context';
import {
  installInlineTraceBodyWrapper,
  isIncludeInlineTraceBodiesRequested,
  isIncludeInlineTraceRequested,
} from './inline-trace';

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

/**
 * Assigns hop ids on an outbound request and returns them for logging / mock metadata.
 * Strips any stale `X-Mockifyer-Request-Id` on the config so each hop gets a fresh id.
 */
export function applyOutboundRequestCorrelation(config: { headers?: unknown }): RequestCorrelationContext {
  applyInboundClientIdToOutboundHeaders(config);
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
}

export interface MockifyerCorrelationMiddlewareResponse {
  setHeader?(name: string, value: string): void;
  json?(body: unknown): unknown;
  send?(body: unknown): unknown;
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

let nodeInboundCaptureInstalled = false;

function patchNodeServerEmit(serverModule: { Server: new (...args: never[]) => unknown }): void {
  const prototype = serverModule.Server.prototype as {
    emit: (event: string, ...args: unknown[]) => boolean;
  };
  const originalEmit = prototype.emit;

  prototype.emit = function patchedServerEmit(
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
        maybeEchoTraceIdOnResponse(res, resolved.traceId, isMockifyerEchoTraceIdEnabled());
        return runWithMockifyerHopContext(resolved.ctx, () => {
          if (res) {
            installInlineTraceBodyWrapper(res);
          }
          return originalEmit.apply(this, [event, ...args]);
        });
      }
    }
    return originalEmit.apply(this, [event, ...args]);
  };
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
  if (nodeInboundCaptureInstalled) {
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
    nodeInboundCaptureInstalled = true;
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

    const shouldEcho =
      options.echoTraceIdOnResponse !== undefined
        ? options.echoTraceIdOnResponse
        : isMockifyerEchoTraceIdEnabled();
    maybeEchoTraceIdOnResponse(res, resolved.traceId, shouldEcho);
    runWithMockifyerHopContext(resolved.ctx, () => {
      installInlineTraceBodyWrapper(res);
      next();
    });
  };
}
