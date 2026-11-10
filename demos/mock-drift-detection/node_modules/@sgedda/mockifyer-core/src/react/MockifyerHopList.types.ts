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
  /** Dashboard `/api/network-events/explain` URL when configured. */
  dashboardExplainUrl?: string;
  /** Local Metro or file URL for crash-scoped trace HTML. */
  localTraceBrowseUrl?: string;
  /** Relative path hint, e.g. `mock-data/atlas-html/incidents/{id}.html`. */
  localTraceFileHint?: string;
  /** Hops shown before “Show more”. Default 8. */
  visibleHopCount?: number;
}
