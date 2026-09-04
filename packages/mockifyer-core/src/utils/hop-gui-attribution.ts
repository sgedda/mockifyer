import type { AtlasDocMap } from './atlas-doc';
import { usageListForHop } from './hop-display';
import type { NetworkEvent, NetworkEventUsage } from './network-event-types';

/** How a hop relates to on-screen GUI vs ambient session traffic. */
export type HopGuiAttribution = 'gui-linked' | 'screen-only' | 'unattributed';

const GUI_LINKED: HopGuiAttribution = 'gui-linked';
const SCREEN_ONLY: HopGuiAttribution = 'screen-only';
const UNATTRIBUTED: HopGuiAttribution = 'unattributed';

/** Collect requestIds linked from CMS node datasources in the doc map. */
export function buildGuiLinkedRequestIdSet(map: AtlasDocMap): Set<string> {
  const ids = new Set<string>();
  for (const page of Object.values(map.pages ?? {})) {
    for (const node of Object.values(page.nodes ?? {})) {
      for (const ds of node.datasources ?? []) {
        const rid = ds.lastRequestId?.trim();
        if (rid) ids.add(rid);
      }
    }
  }
  return ids;
}

function usageLinksCmsNode(usage: NetworkEventUsage): boolean {
  const pageId = usage.cms?.pageId?.trim();
  const nodeId = usage.cms?.nodeId?.trim();
  return Boolean(pageId && nodeId);
}

/**
 * Classify a hop:
 * - **gui-linked** — requestId on a CMS node datasource or usage names a CMS node
 * - **screen-only** — usage tags screen/session context but no GUI/node link
 * - **unattributed** — no usage annotation
 */
export function resolveHopGuiAttribution(
  hop: Pick<NetworkEvent, 'requestId' | 'usage'>,
  guiLinkedRequestIds: ReadonlySet<string>
): HopGuiAttribution {
  const requestId = hop.requestId?.trim();
  if (requestId && guiLinkedRequestIds.has(requestId)) {
    return GUI_LINKED;
  }

  const usages = usageListForHop(hop as NetworkEvent);
  if (usages.length === 0) {
    return UNATTRIBUTED;
  }

  if (usages.some(usageLinksCmsNode)) {
    return GUI_LINKED;
  }

  return SCREEN_ONLY;
}

/** Short badge label for HTML / console. */
export function formatGuiAttributionLabel(kind: HopGuiAttribution): string {
  switch (kind) {
    case GUI_LINKED:
      return 'GUI-linked';
    case SCREEN_ONLY:
      return 'Screen-only';
    default:
      return 'Unattributed';
  }
}

/** Tooltip explaining the badge. */
export function guiAttributionDetail(kind: HopGuiAttribution): string {
  switch (kind) {
    case GUI_LINKED:
      return 'Hop read by a CMS node / presentation (datasource or CMS usage)';
    case SCREEN_ONLY:
      return 'Tagged while a screen was active — received on screen, not tied to a CMS node';
    default:
      return 'No screen or CMS node usage annotation';
  }
}
