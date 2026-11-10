import type { NetworkEventUsage } from './network-event-types';

/**
 * Ambient usage context read when a network event is emitted.
 * Leaf module: network-log imports this, not atlas-usage (which imports network helpers).
 */
export interface AtlasUsageContext {
  screen?: string;
  component?: string;
  label?: string;
  cms?: NetworkEventUsage['cms'];
  datasourceId?: string;
  /** Screen-scoped session id for screenshot dedupe (e.g. useMockifyerScreenSession). */
  sessionId?: string;
}

let usageContext: AtlasUsageContext = {};
const usageContextStack: AtlasUsageContext[] = [];
let usageSessionId: string | null = null;
let usageDashboardBaseUrl: string | undefined;

export function setAtlasUsageDashboardBaseUrl(url: string | undefined): void {
  usageDashboardBaseUrl = url?.trim() || undefined;
}

export function getAtlasUsageDashboardBaseUrl(): string | undefined {
  return usageDashboardBaseUrl;
}

export function setAtlasUsageSessionId(sessionId: string | null): void {
  usageSessionId = sessionId;
}

export function getAtlasUsageSessionId(): string | null {
  return usageSessionId;
}

export function setAtlasUsageContext(ctx: AtlasUsageContext): void {
  usageContext = { ...ctx };
}

export function pushAtlasUsageContextState(ctx: AtlasUsageContext): void {
  usageContextStack.push({ ...usageContext });
  usageContext = { ...ctx };
}

export function popAtlasUsageContextState(): void {
  const prev = usageContextStack.pop();
  usageContext = prev ? { ...prev } : {};
}

export function clearAtlasUsageContextState(): void {
  usageContext = {};
  usageContextStack.length = 0;
}

export function getAtlasUsageContext(): AtlasUsageContext {
  return { ...usageContext };
}

/** Usage to stamp on a network event at emit time (from ambient context). */
export function resolveUsageForNetworkEmit(): NetworkEventUsage | undefined {
  const { screen, component, label, cms, datasourceId } = usageContext;
  if (!screen && !component && !label && !cms && !datasourceId) return undefined;
  return { screen, component, label, cms, datasourceId };
}
