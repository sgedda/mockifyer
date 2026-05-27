import { randomEventId } from './crypto-digest';
import { getOutboundHeaderValue } from './outbound-header';
import { MOCKIFYER_CLIENT_ID_HEADER, getOutboundMockifyerClientIdHeader } from './activation-mode';

/** Outbound hop id — propagated to downstream services and the dashboard. */
export const MOCKIFYER_REQUEST_ID_HEADER = 'x-mockifyer-request-id';

/** Caller hop id — links this outbound request to the request that triggered it. */
export const MOCKIFYER_PARENT_REQUEST_ID_HEADER = 'x-mockifyer-parent-request-id';

export interface RequestCorrelationContext {
  requestId: string;
  parentRequestId?: string;
}

/**
 * Inbound HTTP context for service chains (Express middleware / Node http.Server).
 * Outbound `fetch`/`axios` patched by Mockifyer reads this from AsyncLocalStorage — no manual headers in app code.
 */
export interface MockifyerHopContext {
  /** `X-Mockifyer-Client-Id` on the inbound request (lane for downstream proxy hops). */
  inboundClientId?: string;
  /** Set when inbound carried `X-Mockifyer-Request-Id` (becomes parent for the next outbound hop). */
  correlation?: RequestCorrelationContext;
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

/** AsyncLocalStorage scope for inbound HTTP → outbound chains (Node.js services). */
let hopContextStorage: import('async_hooks').AsyncLocalStorage<MockifyerHopContext> | undefined;

function getHopContextStorage(): import('async_hooks').AsyncLocalStorage<MockifyerHopContext> | undefined {
  if (hopContextStorage) {
    return hopContextStorage;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AsyncLocalStorage } = require('async_hooks') as typeof import('async_hooks');
    hopContextStorage = new AsyncLocalStorage<MockifyerHopContext>();
    return hopContextStorage;
  } catch {
    return undefined;
  }
}

export function getActiveMockifyerHopContext(): MockifyerHopContext | undefined {
  return getHopContextStorage()?.getStore();
}

/** Inbound lane id for the current async scope (from upstream `X-Mockifyer-Client-Id`). */
export function getActiveInboundClientId(): string | undefined {
  return getActiveMockifyerHopContext()?.inboundClientId;
}

export function getActiveRequestCorrelation(): RequestCorrelationContext | undefined {
  return getActiveMockifyerHopContext()?.correlation;
}

export function runWithMockifyerHopContext<T>(ctx: MockifyerHopContext | undefined, fn: () => T): T {
  const storage = getHopContextStorage();
  if (!ctx || !storage) {
    return fn();
  }
  return storage.run(ctx, fn);
}

export function runWithRequestCorrelation<T>(ctx: RequestCorrelationContext | undefined, fn: () => T): T {
  if (!ctx) {
    return fn();
  }
  return runWithMockifyerHopContext({ correlation: ctx }, fn);
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
      const req = args[0] as { headers?: unknown } | undefined;
      const ctx = req?.headers ? captureInboundMockifyerContext(req.headers) : undefined;
      if (ctx) {
        return runWithMockifyerHopContext(ctx, () => originalEmit.apply(this, [event, ...args]));
      }
    }
    return originalEmit.apply(this, [event, ...args]);
  };
}

/**
 * Node.js only: wrap incoming `http(s).Server` requests so outbound Mockifyer calls inherit
 * `X-Mockifyer-Request-Id` from the caller without Express middleware.
 *
 * Installed once when `setupMockifyer` runs. Disable with `MOCKIFYER_AUTO_INBOUND_CORRELATION=false`.
 */
export function installNodeInboundRequestCorrelationCapture(): boolean {
  if (nodeInboundCaptureInstalled) {
    return true;
  }
  if (typeof process === 'undefined' || !process.versions?.node) {
    return false;
  }
  const disabled = String(process.env.MOCKIFYER_AUTO_INBOUND_CORRELATION ?? '')
    .trim()
    .toLowerCase();
  if (disabled === '0' || disabled === 'false' || disabled === 'off' || disabled === 'no') {
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
 * Express/Connect middleware: optional explicit capture when not using Node auto-install
 * (e.g. custom servers) or to scope capture to specific routes only.
 */
export function createMockifyerCorrelationMiddleware(): (
  req: MockifyerCorrelationMiddlewareRequest,
  res: unknown,
  next: () => void
) => void {
  return (req, _res, next) => {
    const ctx = captureInboundMockifyerContext({
      get: (name: string) => req.header(name),
    });
    if (!ctx) {
      next();
      return;
    }
    runWithMockifyerHopContext(ctx, next);
  };
}
