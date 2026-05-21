import { getCurrentScenario } from '@sgedda/mockifyer-core';
import type { NetworkEventSource, NetworkEventTransport } from '@sgedda/mockifyer-core';
import { createNetworkLogStore, newRequestId, type NetworkLogStore } from './network-log-store';

export interface ProxyNetworkLogContext {
  store: NetworkLogStore;
  scenario: string;
  startedAt: number;
  requestId: string;
}

export async function openProxyNetworkLog(
  mockDataPath: string,
  config: import('./dashboard-context').DashboardContextConfig,
  scenario: string | null
): Promise<ProxyNetworkLogContext | null> {
  if (scenario === null) return null;
  try {
    const store = createNetworkLogStore(config);
    return {
      store,
      scenario,
      startedAt: Date.now(),
      requestId: newRequestId(),
    };
  } catch {
    return null;
  }
}

export async function closeProxyNetworkLog(ctx: ProxyNetworkLogContext | null): Promise<void> {
  if (!ctx) return;
  await ctx.store.close().catch(() => undefined);
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
    errorMessage?: string;
    transport?: NetworkEventTransport;
  }
): Promise<void> {
  if (!ctx) return;
  const durationMs = partial.durationMs ?? Math.max(0, Date.now() - ctx.startedAt);
  await ctx.store
    .append(ctx.scenario, {
      requestId: ctx.requestId,
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
