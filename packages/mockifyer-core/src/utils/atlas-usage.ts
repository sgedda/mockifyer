import { ENV_VARS, type MockifyerConfig } from '../types';
import { randomEventId } from './crypto-digest';
import { resolveNetworkLogDashboardUrl } from './network-log';
import type { NetworkEventUsage } from './network-event-types';
import { upsertAtlasDocFromUsage } from './atlas-doc';

export type { NetworkEventUsage };

export interface AtlasUsageAnnotation {
  id: string;
  timestamp: string;
  scenario: string;
  sessionId?: string | null;
  clientId?: string | null;
  requestId: string;
  usage: NetworkEventUsage;
}

export interface AtlasUsageContext {
  screen?: string;
  component?: string;
  label?: string;
  cms?: NetworkEventUsage['cms'];
  datasourceId?: string;
}

let usageContext: AtlasUsageContext = {};
let usageSessionId: string | null = null;
const usageByRequestId = new Map<string, NetworkEventUsage[]>();
const usageAnnotations: AtlasUsageAnnotation[] = [];
const MAX_USAGE_ANNOTATIONS = 2_000;

/** Optional session id for usage annotations (often shared with atlas session). */
export function setAtlasUsageSessionId(sessionId: string | null): void {
  usageSessionId = sessionId;
}

/** Set ambient usage for subsequent outbound hops (auto-stamped on network events). */
export function setAtlasUsageContext(ctx: AtlasUsageContext): void {
  usageContext = { ...ctx };
}

/** Clear ambient usage (e.g. on screen unmount). */
export function clearAtlasUsageContext(): void {
  usageContext = {};
}

export function getAtlasUsageContext(): AtlasUsageContext {
  return { ...usageContext };
}

function contextToUsage(): NetworkEventUsage | undefined {
  const { screen, component, label, cms, datasourceId } = usageContext;
  if (!screen && !component && !label && !cms && !datasourceId) return undefined;
  return {
    screen,
    component,
    label,
    cms,
    datasourceId,
  };
}

/**
 * Usage to stamp on a network event at emit time (from ambient context).
 * Always available when context is set — no atlas mode required.
 */
export function resolveUsageForNetworkEmit(): NetworkEventUsage | undefined {
  return contextToUsage();
}

function rememberUsage(requestId: string, usage: NetworkEventUsage): void {
  const key = requestId.trim();
  if (!key) return;
  const list = usageByRequestId.get(key) ?? [];
  list.push(usage);
  usageByRequestId.set(key, list);
}

/**
 * Record that the app used hop `requestId` (after the fact or at CMS resolve).
 * Merges into local index and POSTs to dashboard when URL is known.
 */
export function recordUsage(input: {
  requestId: string;
  usage: NetworkEventUsage;
  scenario?: string;
  sessionId?: string | null;
  clientId?: string | null;
  config?: Pick<MockifyerConfig, 'atlas' | 'networkLog' | 'proxy'>;
}): AtlasUsageAnnotation | null {
  const requestId = input.requestId?.trim();
  if (!requestId) return null;

  rememberUsage(requestId, input.usage);

  upsertAtlasDocFromUsage({
    scenario: input.scenario,
    screen: input.usage.screen,
    component: input.usage.component,
    datasourceId: input.usage.datasourceId,
    cms: input.usage.cms,
  });

  const annotation: AtlasUsageAnnotation = {
    id: randomEventId(),
    timestamp: new Date().toISOString(),
    scenario: input.scenario?.trim() || 'default',
    sessionId: input.sessionId ?? usageSessionId,
    clientId: input.clientId ?? null,
    requestId,
    usage: input.usage,
  };

  usageAnnotations.unshift(annotation);
  if (usageAnnotations.length > MAX_USAGE_ANNOTATIONS) {
    usageAnnotations.length = MAX_USAGE_ANNOTATIONS;
  }

  void postUsageAnnotation(annotation, input.config);
  return annotation;
}

async function postUsageAnnotation(
  annotation: AtlasUsageAnnotation,
  config?: Pick<MockifyerConfig, 'atlas' | 'networkLog' | 'proxy'>
): Promise<void> {
  if (typeof fetch !== 'function') return;
  const fromEnv =
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_DASHBOARD_URL]?.trim() : undefined;
  const base = resolveNetworkLogDashboardUrl(config ?? {}) || fromEnv;
  if (!base) return;
  try {
    await fetch(`${base.replace(/\/+$/, '')}/api/atlas/usage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ annotation }),
    });
  } catch {
    // ignore
  }
}

export function getUsagesForRequestId(requestId: string): NetworkEventUsage[] {
  return [...(usageByRequestId.get(requestId.trim()) ?? [])];
}

export function getAtlasUsageAnnotations(): readonly AtlasUsageAnnotation[] {
  return usageAnnotations;
}

export function clearAtlasUsageAnnotations(): void {
  usageByRequestId.clear();
  usageAnnotations.length = 0;
}

export function resetAtlasUsageRuntime(): void {
  usageContext = {};
  usageSessionId = null;
  clearAtlasUsageAnnotations();
}

/** Merge usage annotations onto network events by requestId (dashboard / export). */
export function mergeUsageOntoNetworkEvents<
  T extends { requestId?: string | null; usage?: NetworkEventUsage | NetworkEventUsage[] },
>(events: T[], annotations: readonly AtlasUsageAnnotation[]): T[] {
  if (annotations.length === 0) return events;
  const byReq = new Map<string, NetworkEventUsage[]>();
  for (const a of annotations) {
    const list = byReq.get(a.requestId) ?? [];
    list.push(a.usage);
    byReq.set(a.requestId, list);
  }

  return events.map((ev) => {
    const rid = ev.requestId?.trim();
    if (!rid) return ev;
    const extra = byReq.get(rid);
    if (!extra?.length) return ev;

    const existing = ev.usage;
    const existingList = Array.isArray(existing) ? existing : existing ? [existing] : [];
    const merged = [...existingList, ...extra];
    return { ...ev, usage: merged.length === 1 ? merged[0] : merged };
  });
}

/** Format usage for list badges. */
export function formatUsageLabel(usage: NetworkEventUsage): string {
  if (usage.label) return usage.label;
  const parts = [usage.screen, usage.component].filter(Boolean);
  if (parts.length) return parts.join(' / ');
  if (usage.cms?.type) return usage.cms.type;
  if (usage.datasourceId) return usage.datasourceId;
  return 'app';
}
