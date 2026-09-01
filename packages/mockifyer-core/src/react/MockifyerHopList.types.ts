import type { CrashContext, CrashSuspect } from '../utils/incidents';
import type { NetworkEvent } from '../utils/network-event-types';

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
