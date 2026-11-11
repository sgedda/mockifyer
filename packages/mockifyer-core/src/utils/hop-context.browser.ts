/**
 * Browser stub for hop context (AsyncLocalStorage-based request scoping).
 * Browsers don't have async_hooks, and browser fetch doesn't need request-scoped context.
 */

export interface RequestCorrelationContext {
  requestId: string;
  parentRequestId?: string;
}

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
  outboundHeaders?: Record<string, string>;
}

export interface MockifyerHopContext {
  correlation?: RequestCorrelationContext;
  inboundClientId?: string;
  inlineTraceBuffer?: InlineTraceHopBufferItem[];
  mockifyerServerBaseUrl?: string;
  atlasMetroStreamBaseUrl?: string;
}

export function getActiveMockifyerHopContext(): MockifyerHopContext | undefined {
  return undefined;
}

export function getActiveInboundClientId(): string | undefined {
  return undefined;
}

export function getActiveRequestCorrelation(): RequestCorrelationContext | undefined {
  return undefined;
}

export function runWithMockifyerHopContext<T>(_ctx: MockifyerHopContext | undefined, fn: () => T): T {
  return fn();
}

export function runWithRequestCorrelation<T>(_ctx: RequestCorrelationContext | undefined, fn: () => T): T {
  return fn();
}
