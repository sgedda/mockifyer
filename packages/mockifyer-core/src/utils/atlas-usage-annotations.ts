import type { NetworkEventUsage } from './network-event-types';

/**
 * Usage annotations and pure helpers shared by HTML export, HAR, and hop display.
 * This module must not import atlas-doc, atlas-doc-html, atlas-har, or hop-display.
 * Those files import this one; atlas-usage.ts also imports the doc graph.
 */

export interface AtlasUsageAnnotation {
  id: string;
  timestamp: string;
  scenario: string;
  sessionId?: string | null;
  clientId?: string | null;
  requestId: string;
  usage: NetworkEventUsage;
}

const MAX_USAGE_ANNOTATIONS = 2_000;
const usageAnnotations: AtlasUsageAnnotation[] = [];

export function pushAtlasUsageAnnotation(annotation: AtlasUsageAnnotation): void {
  usageAnnotations.unshift(annotation);
  if (usageAnnotations.length > MAX_USAGE_ANNOTATIONS) {
    usageAnnotations.length = MAX_USAGE_ANNOTATIONS;
  }
}

export function getAtlasUsageAnnotations(): readonly AtlasUsageAnnotation[] {
  return usageAnnotations;
}

export function clearAtlasUsageAnnotations(): void {
  usageAnnotations.length = 0;
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

/** Format usage for list badges. */
export function formatUsageLabel(usage: NetworkEventUsage): string {
  if (usage.label) return usage.label;
  const parts = [usage.screen, usage.component].filter(Boolean);
  if (parts.length) return parts.join(' / ');
  if (usage.cms?.type) return usage.cms.type;
  if (usage.datasourceId) return usage.datasourceId;
  return 'app';
}
