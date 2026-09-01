import { formatUsageLabel } from './atlas-usage';
import type { NetworkEvent, NetworkEventUsage } from './network-event-types';

/** Normalize single or array usage on a hop. */
export function usageListForHop(hop: NetworkEvent): NetworkEventUsage[] {
  const u = hop.usage;
  if (!u) return [];
  return Array.isArray(u) ? u : [u];
}

/** Primary screen label for timeline grouping. */
export function primaryScreenForHop(hop: NetworkEvent): string | undefined {
  for (const usage of usageListForHop(hop)) {
    if (usage.screen) return usage.screen;
  }
  return undefined;
}

function formatCmsDetail(cms: NetworkEventUsage['cms']): string | undefined {
  if (!cms) return undefined;
  const parts: string[] = [];
  if (cms.pageId) parts.push(`page:${cms.pageId}`);
  if (cms.nodeId) parts.push(`node:${cms.nodeId}`);
  return parts.length ? parts.join(' ') : undefined;
}

/** Compact hop line for console and crash fallback UI. */
export function formatHopLineForDisplay(hop: NetworkEvent): string {
  const parts = [hop.method, hop.url, hop.source];
  if (hop.status != null) parts.push(String(hop.status));
  if (hop.requestId) parts.push(hop.requestId);

  const usages = usageListForHop(hop);
  if (usages.length) {
    const labels = [...new Set(usages.map(formatUsageLabel).filter(Boolean))];
    if (labels.length) parts.push(`[${labels.join(', ')}]`);
    const cmsDetails = [
      ...new Set(usages.map((u) => formatCmsDetail(u.cms)).filter(Boolean) as string[]),
    ];
    if (cmsDetails.length) parts.push(cmsDetails.join(' · '));
  }

  if (hop.anomalyFlags?.length) parts.push(`⚠ ${hop.anomalyFlags.join(', ')}`);
  return parts.join(' · ');
}

export type HopDisplayRow =
  | { kind: 'screen-header'; screen: string }
  | { kind: 'hop'; hop: NetworkEvent };

/** Insert screen section headers when the primary screen changes (atlas-style timeline). */
export function buildHopDisplayRows(hops: NetworkEvent[]): HopDisplayRow[] {
  const rows: HopDisplayRow[] = [];
  let lastScreen: string | undefined;

  for (const hop of hops) {
    const screen = primaryScreenForHop(hop);
    if (screen && screen !== lastScreen) {
      rows.push({ kind: 'screen-header', screen });
      lastScreen = screen;
    } else if (!screen) {
      lastScreen = undefined;
    }
    rows.push({ kind: 'hop', hop });
  }

  return rows;
}
