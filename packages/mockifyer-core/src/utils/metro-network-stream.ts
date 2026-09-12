/**
 * Metro-hosted network hop ring buffer + log formatting / analysis.
 * Device POSTs hops → Metro middleware stores them → `mockifyer-atlas` tails over SSE.
 */

import type { NetworkEvent } from './network-event-types';
import { truncateUtf8, utf8ByteLength } from './crypto-digest';

export const DEFAULT_METRO_NETWORK_STREAM_MAX_EVENTS = 2_000;
export const DEFAULT_METRO_NETWORK_STREAM_SLOW_MS = 3_000;
export const DEFAULT_METRO_NETWORK_PREVIEW_BYTES = 512;

export type MetroNetworkStreamListener = (event: NetworkEvent) => void;

export interface MetroNetworkStreamAnalysis {
  hopCount: number;
  errorCount: number;
  slowCount: number;
  byHost: Record<string, number>;
  bySource: Record<string, number>;
  byMethod: Record<string, number>;
  p50DurationMs?: number;
  p95DurationMs?: number;
  topSlow: Array<{
    method: string;
    path: string;
    durationMs: number;
    status?: number;
    source: string;
  }>;
  recentErrors: Array<{
    method: string;
    path: string;
    status?: number;
    source: string;
    timestamp: string;
  }>;
}

/**
 * In-memory ring buffer of network hops (newest first), with pub/sub for SSE.
 */
export class MetroNetworkEventBuffer {
  private events: NetworkEvent[] = [];
  private readonly listeners = new Set<MetroNetworkStreamListener>();
  private readonly maxEvents: number;

  constructor(maxEvents: number = DEFAULT_METRO_NETWORK_STREAM_MAX_EVENTS) {
    this.maxEvents = Math.max(1, maxEvents);
  }

  /** Append one hop (newest first). Notifies subscribers. */
  append(event: NetworkEvent): NetworkEvent {
    const slim = slimNetworkEventForMetroStream(event);
    this.events.unshift(slim);
    if (this.events.length > this.maxEvents) {
      this.events.length = this.maxEvents;
    }
    for (const listener of this.listeners) {
      try {
        listener(slim);
      } catch {
        // listener must not break ingest
      }
    }
    return slim;
  }

  /** Newest-first snapshot. */
  list(limit?: number): NetworkEvent[] {
    if (limit == null || limit >= this.events.length) {
      return [...this.events];
    }
    return this.events.slice(0, Math.max(0, limit));
  }

  clear(): void {
    this.events = [];
  }

  get size(): number {
    return this.events.length;
  }

  subscribe(listener: MetroNetworkStreamListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** Module singleton used by Metro middleware (and tests via reset). */
let sharedBuffer: MetroNetworkEventBuffer | null = null;

export function getMetroNetworkEventBuffer(
  maxEvents?: number
): MetroNetworkEventBuffer {
  if (!sharedBuffer) {
    sharedBuffer = new MetroNetworkEventBuffer(maxEvents);
  }
  return sharedBuffer;
}

/** Tests only. */
export function resetMetroNetworkEventBuffer(): void {
  sharedBuffer = null;
}

/**
 * Drop bulky fields so Metro RAM / SSE stay light. Full bodies stay on device / spill files.
 */
export function slimNetworkEventForMetroStream(
  event: NetworkEvent,
  maxPreviewBytes: number = DEFAULT_METRO_NETWORK_PREVIEW_BYTES
): NetworkEvent {
  const slimPreview = (text: string | undefined): string | undefined => {
    if (text == null || text === '') return undefined;
    if (utf8ByteLength(text) <= maxPreviewBytes) return text;
    return truncateUtf8(text, maxPreviewBytes);
  };

  return {
    ...event,
    requestHeaders: undefined,
    responseHeaders: undefined,
    requestBodyPreview: slimPreview(event.requestBodyPreview),
    responseBodyPreview: slimPreview(event.responseBodyPreview),
  };
}

function isErrorHop(event: NetworkEvent): boolean {
  if (event.source === 'error' || event.source === 'blocked') return true;
  if (event.kind === 'incident') return true;
  const status = event.status;
  if (typeof status === 'number' && status >= 400) return true;
  const flags = event.anomalyFlags ?? [];
  return flags.some(
    (f) =>
      f === 'http_error_status' ||
      f === 'network_error' ||
      f === 'graphql_errors' ||
      f.includes('error')
  );
}

function isSlowHop(
  event: NetworkEvent,
  slowMs: number = DEFAULT_METRO_NETWORK_STREAM_SLOW_MS
): boolean {
  if (typeof event.durationMs === 'number' && event.durationMs >= slowMs) return true;
  return (event.anomalyFlags ?? []).includes('slow_response');
}

/** @public error hop heuristic for stream TTY / analyze. */
export function isMetroNetworkErrorHop(event: NetworkEvent): boolean {
  return isErrorHop(event);
}

/** @public slow hop heuristic for stream TTY / analyze. */
export function isMetroNetworkSlowHop(
  event: NetworkEvent,
  slowMs?: number
): boolean {
  return isSlowHop(event, slowMs);
}

function percentile(sortedAsc: number[], p: number): number | undefined {
  if (sortedAsc.length === 0) return undefined;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1)
  );
  return sortedAsc[idx];
}

/** Summarize hops for interactive `a` analyze. */
export function analyzeMetroNetworkEvents(
  events: readonly NetworkEvent[],
  options?: { slowMs?: number; topN?: number }
): MetroNetworkStreamAnalysis {
  const slowMs = options?.slowMs ?? DEFAULT_METRO_NETWORK_STREAM_SLOW_MS;
  const topN = options?.topN ?? 8;
  const byHost: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  const durations: number[] = [];
  let errorCount = 0;
  let slowCount = 0;
  const slowHops: MetroNetworkStreamAnalysis['topSlow'] = [];
  const recentErrors: MetroNetworkStreamAnalysis['recentErrors'] = [];

  for (const e of events) {
    const host = e.host?.trim() || tryHostFromUrl(e.url) || '(unknown)';
    byHost[host] = (byHost[host] ?? 0) + 1;
    const source = e.source || 'unknown';
    bySource[source] = (bySource[source] ?? 0) + 1;
    const method = (e.method || '?').toUpperCase();
    byMethod[method] = (byMethod[method] ?? 0) + 1;

    if (typeof e.durationMs === 'number' && Number.isFinite(e.durationMs)) {
      durations.push(e.durationMs);
    }
    if (isErrorHop(e)) {
      errorCount += 1;
      if (recentErrors.length < topN) {
        recentErrors.push({
          method,
          path: e.path || e.url || '/',
          status: e.status,
          source,
          timestamp: e.timestamp,
        });
      }
    }
    if (isSlowHop(e, slowMs)) {
      slowCount += 1;
      slowHops.push({
        method,
        path: e.path || e.url || '/',
        durationMs: e.durationMs ?? 0,
        status: e.status,
        source,
      });
    }
  }

  slowHops.sort((a, b) => b.durationMs - a.durationMs);
  durations.sort((a, b) => a - b);

  return {
    hopCount: events.length,
    errorCount,
    slowCount,
    byHost,
    bySource,
    byMethod,
    p50DurationMs: percentile(durations, 50),
    p95DurationMs: percentile(durations, 95),
    topSlow: slowHops.slice(0, topN),
    recentErrors,
  };
}

function tryHostFromUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    return new URL(url).host || undefined;
  } catch {
    return undefined;
  }
}

/** One-line terminal log for a hop. */
export function formatMetroNetworkHopLine(event: NetworkEvent): string {
  const ts = event.timestamp ? event.timestamp.slice(11, 23) : '--:--:--.---';
  const method = (event.method || '?').toUpperCase().padEnd(6);
  const status =
    event.status != null ? String(event.status).padStart(3) : event.source === 'error' ? 'ERR' : '  -';
  const ms =
    typeof event.durationMs === 'number' && Number.isFinite(event.durationMs)
      ? `${Math.round(event.durationMs)}ms`.padStart(7)
      : '      -';
  const source = (event.source || '').padEnd(10);
  const path = event.path || event.url || '/';
  const flags: string[] = [];
  if (isErrorHop(event)) flags.push('ERR');
  if (isSlowHop(event)) flags.push('SLOW');
  const screen = firstUsageScreen(event.usage);
  if (screen) flags.push(`screen=${screen}`);
  const flagStr = flags.length ? `  [${flags.join(' ')}]` : '';
  return `${ts}  ${method} ${status}  ${ms}  ${source}  ${path}${flagStr}`;
}

function firstUsageScreen(
  usage: NetworkEvent['usage']
): string | undefined {
  if (!usage) return undefined;
  if (Array.isArray(usage)) {
    for (const u of usage) {
      const s = u.screen?.trim();
      if (s) return s;
    }
    return undefined;
  }
  return usage.screen?.trim() || undefined;
}

/** Pretty-print analysis for the interactive CLI. */
export function formatMetroNetworkAnalysis(
  analysis: MetroNetworkStreamAnalysis,
  options?: { slowMs?: number }
): string {
  const slowMs = options?.slowMs ?? DEFAULT_METRO_NETWORK_STREAM_SLOW_MS;
  const lines: string[] = [
    `hops=${analysis.hopCount}  errors=${analysis.errorCount}  slow(≥${slowMs}ms)=${analysis.slowCount}`,
  ];
  if (analysis.p50DurationMs != null || analysis.p95DurationMs != null) {
    lines.push(
      `duration  p50=${analysis.p50DurationMs ?? '-'}ms  p95=${analysis.p95DurationMs ?? '-'}ms`
    );
  }
  lines.push(`by source: ${formatCountMap(analysis.bySource)}`);
  lines.push(`by method: ${formatCountMap(analysis.byMethod)}`);
  const hosts = Object.entries(analysis.byHost)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([h, n]) => `${h}=${n}`)
    .join('  ');
  if (hosts) lines.push(`top hosts: ${hosts}`);
  if (analysis.topSlow.length > 0) {
    lines.push('slowest:');
    for (const s of analysis.topSlow) {
      lines.push(
        `  ${s.durationMs}ms  ${s.method} ${s.status ?? '-'}  ${s.path}  (${s.source})`
      );
    }
  }
  if (analysis.recentErrors.length > 0) {
    lines.push('recent errors:');
    for (const e of analysis.recentErrors) {
      lines.push(`  ${e.method} ${e.status ?? '-'}  ${e.path}  (${e.source})`);
    }
  }
  return lines.join('\n');
}

function formatCountMap(map: Record<string, number>): string {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}=${n}`)
    .join('  ');
}

const DEFAULT_METRO_PORT = 8081;

export function resolveMetroNetworkStreamPort(explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  if (typeof process !== 'undefined') {
    const fromEnv = process.env.METRO_PORT?.trim();
    if (fromEnv) {
      const n = Number.parseInt(fromEnv, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return DEFAULT_METRO_PORT;
}

/**
 * Base URL for Metro hop ingest/stream, or undefined when disabled.
 * - `MOCKIFYER_METRO_STREAM=off` → disabled
 * - `on` / `true` → enabled
 * - unset → enabled when `METRO_PORT` is set or React Native is detected
 */
export function resolveMetroNetworkStreamBaseUrl(options?: {
  metroPort?: number;
}): string | undefined {
  if (typeof process !== 'undefined') {
    const raw = process.env.MOCKIFYER_METRO_STREAM?.trim().toLowerCase();
    if (raw === 'off' || raw === 'false' || raw === '0' || raw === 'no') {
      return undefined;
    }
    if (raw === 'on' || raw === 'true' || raw === '1' || raw === 'yes') {
      return `http://localhost:${resolveMetroNetworkStreamPort(options?.metroPort)}`;
    }
    const explicitUrl = process.env.MOCKIFYER_METRO_URL?.trim();
    if (explicitUrl) {
      return explicitUrl.replace(/\/+$/, '');
    }
    if (process.env.METRO_PORT?.trim()) {
      return `http://localhost:${resolveMetroNetworkStreamPort(options?.metroPort)}`;
    }
  }

  if (isLikelyReactNativeRuntime()) {
    return `http://localhost:${resolveMetroNetworkStreamPort(options?.metroPort)}`;
  }

  return undefined;
}

function isLikelyReactNativeRuntime(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : undefined;
    if (nav?.product === 'ReactNative') return true;
  } catch {
    // ignore
  }
  return false;
}

export function joinMetroNetworkEventsUrl(metroBaseUrl: string): string {
  return `${metroBaseUrl.replace(/\/+$/, '')}/mockifyer-network-events`;
}
