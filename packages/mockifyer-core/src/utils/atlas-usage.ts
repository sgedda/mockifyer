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
/** Nested screen sessions push previous context here. */
const usageContextStack: AtlasUsageContext[] = [];
let usageSessionId: string | null = null;
/** Prefer atlas.dashboardBaseUrl from {@link configureAtlas}. */
let usageDashboardBaseUrl: string | undefined;
const usageByRequestId = new Map<string, NetworkEventUsage[]>();
const usageAnnotations: AtlasUsageAnnotation[] = [];
const MAX_USAGE_ANNOTATIONS = 2_000;

/** Called from {@link configureAtlas} so usage POSTs share the atlas dashboard URL. */
export function setAtlasUsageDashboardBaseUrl(url: string | undefined): void {
  usageDashboardBaseUrl = url?.trim() || undefined;
}

/** Dashboard origin captured at {@link configureAtlas} (proxy / networkLog / env). */
export function getAtlasUsageDashboardBaseUrl(): string | undefined {
  return usageDashboardBaseUrl;
}

/** Optional session id for usage annotations (often shared with atlas session). */
export function setAtlasUsageSessionId(sessionId: string | null): void {
  usageSessionId = sessionId;
}

/** Set ambient usage for subsequent outbound hops (auto-stamped on network events). */
export function setAtlasUsageContext(ctx: AtlasUsageContext): void {
  usageContext = { ...ctx };
}

/**
 * Push ambient usage (nested screens). Pair with {@link popAtlasUsageContext} on unmount.
 */
export function pushAtlasUsageContext(ctx: AtlasUsageContext): void {
  usageContextStack.push({ ...usageContext });
  usageContext = { ...ctx };
}

/** Restore previous ambient usage after {@link pushAtlasUsageContext}. */
export function popAtlasUsageContext(): void {
  const prev = usageContextStack.pop();
  usageContext = prev ? { ...prev } : {};
}

/** Clear ambient usage (e.g. on screen unmount when not using push/pop). */
export function clearAtlasUsageContext(): void {
  usageContext = {};
  usageContextStack.length = 0;
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

function usageDedupeKey(usage: NetworkEventUsage): string {
  return [
    usage.screen ?? '',
    usage.component ?? '',
    usage.label ?? '',
    usage.datasourceId ?? '',
    usage.dataRoot ?? '',
    usage.cms?.pageId ?? '',
    usage.cms?.nodeId ?? '',
    usage.cms?.type ?? '',
    usage.cms?.path ?? '',
  ].join('\0');
}

/** Deduplicate usage entries that describe the same consumer. */
export function dedupeUsageList(list: NetworkEventUsage[]): NetworkEventUsage[] {
  const seen = new Set<string>();
  const out: NetworkEventUsage[] = [];
  for (const u of list) {
    const key = usageDedupeKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

function rememberUsage(requestId: string, usage: NetworkEventUsage): void {
  const key = requestId.trim();
  if (!key) return;
  const list = usageByRequestId.get(key) ?? [];
  list.push(usage);
  usageByRequestId.set(key, dedupeUsageList(list));
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
    dataRoot: input.usage.dataRoot,
    requestId,
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
  const fromAtlasConfig =
    config && 'atlas' in (config as object)
      ? (config as MockifyerConfig).atlas?.dashboardBaseUrl?.trim()
      : undefined;
  const base =
    usageDashboardBaseUrl ||
    fromAtlasConfig ||
    resolveNetworkLogDashboardUrl(config ?? {}) ||
    fromEnv;
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
  usageContextStack.length = 0;
  usageSessionId = null;
  usageDashboardBaseUrl = undefined;
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
    const merged = dedupeUsageList([...existingList, ...extra]);
    return { ...ev, usage: merged.length === 1 ? merged[0] : merged };
  });
}

/**
 * Merge in-process atlas usage onto network events (emit-time usage + annotations index).
 * Used by crash forensics and dashboard exports.
 */
export function enrichNetworkEventsWithAtlasUsage<
  T extends { requestId?: string | null; usage?: NetworkEventUsage | NetworkEventUsage[] },
>(events: T[]): T[] {
  const merged = mergeUsageOntoNetworkEvents(events, getAtlasUsageAnnotations());
  return merged.map((ev) => {
    if (ev.usage) return ev;
    const rid = ev.requestId?.trim();
    if (!rid) return ev;
    const extra = getUsagesForRequestId(rid);
    if (!extra.length) return ev;
    return { ...ev, usage: extra.length === 1 ? extra[0] : dedupeUsageList(extra) };
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
