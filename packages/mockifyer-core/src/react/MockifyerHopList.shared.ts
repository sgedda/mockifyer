import type { CrashContext, CrashSuspect } from '../utils/incidents';
import type { NetworkEvent } from '../utils/network-event-types';

export const DEFAULT_VISIBLE_HOPS = 8;

export function isSuspect(hop: NetworkEvent, suspects?: CrashSuspect[]): boolean {
  if (!suspects?.length) return Boolean(hop.anomalyFlags?.length);
  return suspects.some((s) => s.eventId === hop.id);
}

export interface MockifyerHopListProps {
  /** Pre-sorted most-relevant-first from {@link getCrashContext}. */
  hops: NetworkEvent[];
  suspects?: CrashSuspect[];
  prefetchHopIds?: string[];
  maxItems?: number;
}

export interface MockifyerCrashFallbackProps {
  error: Error;
  crashContext: CrashContext | null;
  incidentId?: string | null;
  /** Hops shown before “Show more”. Default 8. */
  visibleHopCount?: number;
}
