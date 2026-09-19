import { getCurrentScenario, type MockData } from '@sgedda/mockifyer-core';
import type { NetworkEventSource, NetworkEventTransport } from '@sgedda/mockifyer-core';
import {
  registerHopOwner,
  resolveRecordedHopIdentity,
  type RecordedHopIdentity,
} from '@sgedda/mockifyer-core';
import { createNetworkLogStore, newRequestId, type NetworkLogStore } from './network-log-store';

export interface ProxyNetworkLogContext {
  store: NetworkLogStore;
  scenario: string;
  startedAt: number;
  requestId: string;
  parentRequestId?: string | null;
}

export interface ProxyNetworkLogCorrelation {
  requestId?: string;
  parentRequestId?: string | null;
}

export async function openProxyNetworkLog(
  mockDataPath: string,
  config: import('./dashboard-context').DashboardContextConfig,
  scenario: string | null,
  correlation?: ProxyNetworkLogCorrelation
): Promise<ProxyNetworkLogContext | null> {
  if (scenario === null) return null;
  try {
    const store = createNetworkLogStore(config);
    const requestId =
      typeof correlation?.requestId === 'string' && correlation.requestId.trim()
        ? correlation.requestId.trim()
        : newRequestId();
    const parentRequestId =
      typeof correlation?.parentRequestId === 'string' && correlation.parentRequestId.trim()
        ? correlation.parentRequestId.trim()
        : null;
    return {
      store,
      scenario,
      startedAt: Date.now(),
      requestId,
      parentRequestId,
    };
  } catch {
    return null;
  }
}

export async function closeProxyNetworkLog(ctx: ProxyNetworkLogContext | null): Promise<void> {
  if (!ctx) return;
  await ctx.store.close().catch(() => undefined);
}

/** Wall-clock ms since `openProxyNetworkLog`, when the timer is valid. */
export function proxyNetworkElapsedMs(ctx: ProxyNetworkLogContext | null | undefined): number | undefined {
  if (!ctx || typeof ctx.startedAt !== 'number' || !Number.isFinite(ctx.startedAt)) {
    return undefined;
  }
  const ms = Date.now() - ctx.startedAt;
  if (!Number.isFinite(ms) || ms <= 0) {
    return undefined;
  }
  return ms;
}

export async function appendProxyNetworkEvent(
  ctx: ProxyNetworkLogContext | null,
  partial: {
    method: string;
    url: string;
    clientId?: string | null;
    deviceId?: string | null;
    source: NetworkEventSource;
    status?: number;
    durationMs?: number;
    requestHash?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBodyPreview?: string;
    responseBodyPreview?: string;
    errorMessage?: string;
    transport?: NetworkEventTransport;
  }
): Promise<void> {
  if (!ctx) return;
  const durationMs = partial.durationMs ?? proxyNetworkElapsedMs(ctx) ?? 0;
  await ctx.store
    .append(ctx.scenario, {
      requestId: ctx.requestId,
      parentRequestId: ctx.parentRequestId ?? null,
      phase: 'complete',
      transport: partial.transport ?? 'proxy',
      method: partial.method,
      url: partial.url,
      clientId: partial.clientId ?? null,
      deviceId: partial.deviceId ?? null,
      source: partial.source,
      status: partial.status,
      durationMs,
      requestHash: partial.requestHash,
      requestHeaders: partial.requestHeaders,
      responseHeaders: partial.responseHeaders,
      requestBodyPreview: partial.requestBodyPreview,
      responseBodyPreview: partial.responseBodyPreview,
      errorMessage: partial.errorMessage,
    })
    .catch(() => undefined);
}

export function resolveNetworkLogScenario(
  mockDataPath: string,
  scenarioFromResolution: string | null,
  bodyScenario?: string
): string | null {
  if (scenarioFromResolution) return scenarioFromResolution;
  if (bodyScenario?.trim()) return bodyScenario.trim();
  try {
    return getCurrentScenario(mockDataPath);
  } catch {
    return 'default';
  }
}

function readCorrelationHeader(req: import('express').Request, name: string): string | undefined {
  const raw = req.header(name);
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveProxyHopIdentity(
  inbound: ProxyNetworkLogCorrelation,
  method: string,
  url: string,
  storedRequestId?: string | null
): RecordedHopIdentity {
  const identity = resolveRecordedHopIdentity({
    inboundRequestId: inbound.requestId,
    inboundParentRequestId: inbound.parentRequestId,
    method,
    url,
    storedRequestId,
  });
  registerHopOwner({
    requestId: identity.requestId,
    method,
    url,
  });
  return identity;
}

export function applyHopIdentityToProxyLog(
  ctx: ProxyNetworkLogContext | null,
  identity: RecordedHopIdentity
): void {
  if (!ctx) return;
  ctx.requestId = identity.requestId;
  ctx.parentRequestId = identity.parentRequestId ?? null;
}

export function resolveProxyInboundCorrelation(req: import('express').Request, body: unknown): ProxyNetworkLogCorrelation {
  const payload = (body ?? {}) as { requestId?: unknown; parentRequestId?: unknown };
  const requestIdFromBody =
    typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : undefined;
  const parentFromBody =
    typeof payload.parentRequestId === 'string' && payload.parentRequestId.trim()
      ? payload.parentRequestId.trim()
      : undefined;

  const requestId = requestIdFromBody ?? readCorrelationHeader(req, 'x-mockifyer-request-id');
  const parentRequestId = parentFromBody ?? readCorrelationHeader(req, 'x-mockifyer-parent-request-id');

  return {
    requestId,
    parentRequestId: parentRequestId ?? null,
  };
}

/** Persist hop ids on recorded mocks so the Mocks page can link the same chain as Network.
 * Existing ids stay put so always-refresh does not break parentRequestId links.
 * Also stamps round-trip `duration` so Statistics can rank slowest leaf hops.
 */
export function applyProxyCorrelationToMockData(
  mock: MockData,
  ctx: ProxyNetworkLogContext | null,
  inbound?: ProxyNetworkLogCorrelation
): void {
  const requestId =
    ctx?.requestId ??
    (typeof inbound?.requestId === 'string' && inbound.requestId.trim() ? inbound.requestId.trim() : undefined);
  const parentRequestId =
    ctx?.parentRequestId ??
    (typeof inbound?.parentRequestId === 'string' && inbound.parentRequestId.trim()
      ? inbound.parentRequestId.trim()
      : undefined);
  if (requestId && !mock.requestId?.trim()) {
    mock.requestId = requestId;
  }
  if (parentRequestId) {
    mock.parentRequestId = parentRequestId;
  }
  const durationMs = proxyNetworkElapsedMs(ctx);
  if (durationMs != null) {
    mock.duration = durationMs;
  }
}

/** Prefer the hop id already stored on a matched mock for this proxy request. */
export function adoptStoredHopIdOnProxyLog(
  ctx: ProxyNetworkLogContext | null,
  mock: { requestId?: string | null } | null | undefined
): void {
  const stored = mock?.requestId?.trim();
  if (!ctx || !stored) {
    return;
  }
  ctx.requestId = stored;
}

/** Trace ids for proxy JSON responses and `X-Mockifyer-Request-Id` response header. */
export function resolveProxyTraceIds(
  networkLogCtx: ProxyNetworkLogContext | null,
  inbound?: ProxyNetworkLogCorrelation
): { requestId?: string; parentRequestId?: string | null } {
  const requestId =
    networkLogCtx?.requestId ??
    (typeof inbound?.requestId === 'string' && inbound.requestId.trim()
      ? inbound.requestId.trim()
      : undefined);
  const parentRequestId =
    networkLogCtx?.parentRequestId ??
    (typeof inbound?.parentRequestId === 'string' && inbound.parentRequestId.trim()
      ? inbound.parentRequestId.trim()
      : null);
  return {
    ...(requestId ? { requestId } : {}),
    ...(parentRequestId ? { parentRequestId } : {}),
  };
}

export function applyUpstreamRequestCorrelationHeaders(
  upstreamHeaders: Headers,
  correlation: ProxyNetworkLogCorrelation | ProxyNetworkLogContext
): void {
  const requestId =
    'requestId' in correlation && typeof correlation.requestId === 'string' ? correlation.requestId : undefined;
  const parentRequestId =
    'parentRequestId' in correlation ? correlation.parentRequestId ?? undefined : undefined;

  if (requestId) {
    upstreamHeaders.set('x-mockifyer-request-id', requestId);
  }
  if (parentRequestId) {
    upstreamHeaders.set('x-mockifyer-parent-request-id', parentRequestId);
  }
}
