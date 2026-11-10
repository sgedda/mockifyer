/**
 * Session request scrubber — classify hops as future / in-flight / done at playhead T.
 * Used by Atlas HTML Scrub tab (and unit tests). Interactive client mirrors these rules.
 */

/** Minimal hop shape needed for scrub timing (full NetworkEvent is fine). */
export interface ScrubHopTiming {
  id?: string;
  timestamp: string;
  durationMs?: number;
  /** Filled by Atlas HTML when parent duration is estimated from children. */
  _estimatedDurationMs?: number;
}

export type ScrubHopState = 'future' | 'in-flight' | 'done';

export interface SessionTimeline {
  /** Absolute wall-clock start of the earliest hop (ms since epoch). */
  t0Ms: number;
  /** Session span from first hop start to last hop end (ms). At least 1. */
  spanMs: number;
}

export interface ScrubHopSummary {
  event: ScrubHopTiming;
  /** Offset from session t0 (ms). */
  startMs: number;
  durationMs: number;
  state: ScrubHopState;
}

export interface ScrubSummary {
  timeline: SessionTimeline;
  playheadMs: number;
  counts: { future: number; inFlight: number; done: number; appeared: number };
  /** Hops that have started by playhead (in-flight + done), sorted by start. */
  appeared: ScrubHopSummary[];
  /** All hops with state, sorted by start. */
  all: ScrubHopSummary[];
}

export interface ScrubScreenshotCandidate {
  path: string;
  capturedAt?: string;
  label?: string;
}

/** Fallback duration when hop has no durationMs / estimate (matches Atlas HTML timing()). */
export const SCRUB_FALLBACK_DURATION_MS = 8;

/**
 * Prefer measured durationMs, else estimated, else fallback.
 */
export function resolveHopDurationMs(event: ScrubHopTiming): number {
  const raw =
    typeof event.durationMs === 'number'
      ? event.durationMs
      : typeof event._estimatedDurationMs === 'number'
        ? event._estimatedDurationMs
        : undefined;
  if (typeof raw === 'number' && raw > 0 && Number.isFinite(raw)) {
    return Math.max(raw, 1);
  }
  return SCRUB_FALLBACK_DURATION_MS;
}

/**
 * Session clock: t0 = earliest hop start; span = last (start + duration) − t0.
 */
export function computeSessionTimeline(events: readonly ScrubHopTiming[]): SessionTimeline {
  if (!events.length) {
    return { t0Ms: 0, spanMs: 1 };
  }
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const e of events) {
    const s = new Date(e.timestamp).getTime();
    if (!Number.isFinite(s)) continue;
    const d = resolveHopDurationMs(e);
    t0 = Math.min(t0, s);
    t1 = Math.max(t1, s + d);
  }
  if (!Number.isFinite(t0)) {
    return { t0Ms: 0, spanMs: 1 };
  }
  if (!(t1 > t0)) {
    t1 = t0 + 1;
  }
  return { t0Ms: t0, spanMs: t1 - t0 };
}

/**
 * Classify a hop relative to playhead offset from session t0.
 */
export function hopStateAt(
  event: ScrubHopTiming,
  playheadMs: number,
  t0Ms: number
): ScrubHopState {
  const startAbs = new Date(event.timestamp).getTime();
  if (!Number.isFinite(startAbs)) return 'future';
  const start = startAbs - t0Ms;
  const end = start + resolveHopDurationMs(event);
  if (start > playheadMs) return 'future';
  if (end <= playheadMs) return 'done';
  return 'in-flight';
}

function clampPlayhead(playheadMs: number, spanMs: number): number {
  if (!Number.isFinite(playheadMs) || playheadMs < 0) return 0;
  if (playheadMs > spanMs) return spanMs;
  return playheadMs;
}

/**
 * Summarize hop states at a playhead (offset from session t0).
 * Optional `t0Ms` overrides the computed session start (span is still derived from hops).
 */
export function summarizeScrub(
  events: readonly ScrubHopTiming[],
  playheadMs: number,
  t0Ms?: number
): ScrubSummary {
  const computed = computeSessionTimeline(events);
  const t0 =
    typeof t0Ms === 'number' && Number.isFinite(t0Ms) ? t0Ms : computed.t0Ms;
  let t1 = t0;
  for (const e of events) {
    const s = new Date(e.timestamp).getTime();
    if (!Number.isFinite(s)) continue;
    t1 = Math.max(t1, s + resolveHopDurationMs(e));
  }
  if (!(t1 > t0)) t1 = t0 + 1;
  const timeline: SessionTimeline = { t0Ms: t0, spanMs: t1 - t0 };
  const ph = clampPlayhead(playheadMs, timeline.spanMs);
  const all: ScrubHopSummary[] = events
    .map((event) => {
      const startAbs = new Date(event.timestamp).getTime();
      const startMs = Number.isFinite(startAbs) ? startAbs - timeline.t0Ms : 0;
      const durationMs = resolveHopDurationMs(event);
      return {
        event,
        startMs,
        durationMs,
        state: hopStateAt(event, ph, timeline.t0Ms),
      };
    })
    .sort((a, b) => a.startMs - b.startMs);

  const counts = { future: 0, inFlight: 0, done: 0, appeared: 0 };
  const appeared: ScrubHopSummary[] = [];
  for (const row of all) {
    if (row.state === 'future') {
      counts.future += 1;
    } else if (row.state === 'in-flight') {
      counts.inFlight += 1;
      counts.appeared += 1;
      appeared.push(row);
    } else {
      counts.done += 1;
      counts.appeared += 1;
      appeared.push(row);
    }
  }

  return { timeline, playheadMs: ph, counts, appeared, all };
}

/**
 * Latest screenshot with capturedAt &lt;= absoluteMs (wall clock).
 * Shots without a parseable capturedAt are ignored.
 */
export function nearestScreenshotAt(
  shots: readonly ScrubScreenshotCandidate[],
  absoluteMs: number
): ScrubScreenshotCandidate | undefined {
  if (!Number.isFinite(absoluteMs) || !shots.length) return undefined;
  let best: ScrubScreenshotCandidate | undefined;
  let bestAt = -Infinity;
  for (const shot of shots) {
    if (!shot?.path?.trim()) continue;
    const at = shot.capturedAt ? new Date(shot.capturedAt).getTime() : NaN;
    if (!Number.isFinite(at) || at > absoluteMs) continue;
    if (at >= bestAt) {
      bestAt = at;
      best = shot;
    }
  }
  return best;
}
