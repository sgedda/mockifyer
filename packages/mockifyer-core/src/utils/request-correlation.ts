import { randomEventId } from './crypto-digest';
import { getOutboundHeaderValue } from './outbound-header';

/** Outbound hop id — propagated to downstream services and the dashboard. */
export const MOCKIFYER_REQUEST_ID_HEADER = 'x-mockifyer-request-id';

/** Caller hop id — links this outbound request to the request that triggered it. */
export const MOCKIFYER_PARENT_REQUEST_ID_HEADER = 'x-mockifyer-parent-request-id';

export interface RequestCorrelationContext {
  requestId: string;
  parentRequestId?: string;
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
 * Reads correlation from inbound HTTP headers (Express, fetch, axios).
 */
export function captureInboundRequestCorrelation(headers: unknown): RequestCorrelationContext | undefined {
  const requestId = getOutboundMockifyerRequestIdHeader(headers);
  if (!requestId) {
    return undefined;
  }
  const parentRequestId = getOutboundMockifyerParentRequestIdHeader(headers);
  return parentRequestId ? { requestId, parentRequestId } : { requestId };
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
let correlationStorage: import('async_hooks').AsyncLocalStorage<RequestCorrelationContext> | undefined;

function getCorrelationStorage(): import('async_hooks').AsyncLocalStorage<RequestCorrelationContext> | undefined {
  if (correlationStorage) {
    return correlationStorage;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AsyncLocalStorage } = require('async_hooks') as typeof import('async_hooks');
    correlationStorage = new AsyncLocalStorage<RequestCorrelationContext>();
    return correlationStorage;
  } catch {
    return undefined;
  }
}

export function getActiveRequestCorrelation(): RequestCorrelationContext | undefined {
  return getCorrelationStorage()?.getStore();
}

export function runWithRequestCorrelation<T>(ctx: RequestCorrelationContext | undefined, fn: () => T): T {
  const storage = getCorrelationStorage();
  if (!ctx || !storage) {
    return fn();
  }
  return storage.run(ctx, fn);
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

/**
 * Assigns hop ids on an outbound request and returns them for logging / mock metadata.
 * Strips any stale `X-Mockifyer-Request-Id` on the config so each hop gets a fresh id.
 */
export function applyOutboundRequestCorrelation(config: { headers?: unknown }): RequestCorrelationContext {
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
      const ctx = req?.headers ? captureInboundRequestCorrelation(req.headers) : undefined;
      if (ctx) {
        return runWithRequestCorrelation(ctx, () => originalEmit.apply(this, [event, ...args]));
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
    const ctx = captureInboundRequestCorrelation({
      get: (name: string) => req.header(name),
    });
    if (!ctx) {
      next();
      return;
    }
    runWithRequestCorrelation(ctx, next);
  };
}
