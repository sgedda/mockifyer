/**
 * Request-scoped hop context (AsyncLocalStorage).
 *
 * Kept separate from `request-correlation` and `inline-trace` so those modules
 * can import each other without a circular dependency (lazy `require` is unsafe
 * under Jest teardown and can poison the module cache).
 */

export interface RequestCorrelationContext {
  requestId: string;
  parentRequestId?: string;
}

/**
 * Inbound HTTP context for service chains (Express middleware / Node http.Server).
 * Outbound `fetch`/`axios` patched by Mockifyer reads this from AsyncLocalStorage.
 */
export interface InlineTraceHopBufferItem {
  index: number;
  requestId: string | null;
  parentRequestId: string | null;
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  source: string;
  durationMs?: number;
  transport: string;
  clientId?: string | null;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  errorMessage?: string;
}

export interface MockifyerHopContext {
  /** `X-Mockifyer-Client-Id` on the inbound request (lane for downstream proxy hops). */
  inboundClientId?: string;
  /** Set when inbound carried `X-Mockifyer-Request-Id` (becomes parent for the next outbound hop). */
  correlation?: RequestCorrelationContext;
  /**
   * When true, outbound Mockifyer hops are collected on {@link inlineHops} for this request
   * and can be wrapped into the HTTP response body (test/debug).
   */
  includeInlineTrace?: boolean;
  /** When true with {@link includeInlineTrace}, store truncated body previews on hops. */
  includeInlineTraceBodies?: boolean;
  /** Mutable in-process hop list for the active inbound request. */
  inlineHops?: InlineTraceHopBufferItem[];
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
