/**
 * Metro-hosted network hop ring buffer + log formatting / analysis.
 * Device POSTs hops → Metro middleware stores them → `mockifyer-atlas` tails over SSE.
 */

import type { NetworkEvent } from "./network-event-types";
import { truncateUtf8, utf8ByteLength } from "./crypto-digest";
import { NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES } from "./network-body-spill";

export const DEFAULT_METRO_NETWORK_STREAM_MAX_EVENTS = 2_000;
export const DEFAULT_METRO_NETWORK_STREAM_SLOW_MS = 3_000;
/** Keep Atlas live / SSE previews aligned with hop inline budget (spill still holds the full body). */
export const DEFAULT_METRO_NETWORK_PREVIEW_BYTES =
  NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES;

const REDACTED_HEADER_VALUE = "[REDACTED]";

function headerValueIsPlaceholder(value: string | undefined): boolean {
  const text = value?.trim();
  return !text || text === REDACTED_HEADER_VALUE;
}

function headersByLowerName(headers: Record<string, string> | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!headers) return out;
  for (const [name, value] of Object.entries(headers)) {
    const key = name.trim().toLowerCase();
    if (!key || value == null) continue;
    out.set(key, String(value));
  }
  return out;
}

function pickHeaderValue(previous: string | undefined, incoming: string | undefined): string | undefined {
  if (!headerValueIsPlaceholder(incoming)) return incoming;
  if (!headerValueIsPlaceholder(previous)) return previous;
  return incoming ?? previous;
}

function pickBodyPreview(previous: string | undefined, incoming: string | undefined): string | undefined {
  if (!incoming) return previous;
  if (!previous) return incoming;
  const incomingCut = incoming.includes("[truncated]");
  const previousCut = previous.includes("[truncated]");
  if (previousCut && !incomingCut) return incoming;
  if (incomingCut && !previousCut) return previous;
  return incoming.length >= previous.length ? incoming : previous;
}

/**
 * Same hop posted twice (Metro, then a redacted dashboard enrich, or the reverse).
 * Keep a real authorization token and the fuller request body so stream curl can run.
 */
export function mergeNetworkEventPreferRunnable(
  previous: NetworkEvent,
  incoming: NetworkEvent
): NetworkEvent {
  const previousHeaders = headersByLowerName(previous.requestHeaders);
  const incomingHeaders = headersByLowerName(incoming.requestHeaders);
  const names = new Set([...previousHeaders.keys(), ...incomingHeaders.keys()]);
  const requestHeaders: Record<string, string> = {};
  for (const name of names) {
    const value = pickHeaderValue(previousHeaders.get(name), incomingHeaders.get(name));
    if (value != null) requestHeaders[name] = value;
  }
  const requestBodyPreview = pickBodyPreview(
    previous.requestBodyPreview,
    incoming.requestBodyPreview
  );
  const responseBodyPreview = pickBodyPreview(
    previous.responseBodyPreview,
    incoming.responseBodyPreview
  );
  return {
    ...incoming,
    requestHeaders: Object.keys(requestHeaders).length > 0 ? requestHeaders : incoming.requestHeaders,
    ...(requestBodyPreview != null ? { requestBodyPreview } : {}),
    ...(responseBodyPreview != null ? { responseBodyPreview } : {}),
    requestBodyRef: incoming.requestBodyRef ?? previous.requestBodyRef,
    responseBodyRef: incoming.responseBodyRef ?? previous.responseBodyRef,
  };
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}

export type MetroNetworkStreamListener = (event: NetworkEvent) => void;

/** Response body filled in after an Atlas capture stops (the app defers it while capturing). */
export interface NetworkEventResponseBodyPatch {
  /** Hop `id` the app emitted. */
  id: string;
  /** Fallback match when the buffered copy was merged under a different `id`. */
  requestId?: string;
  responseBodyPreview?: string;
  responseBodyRef?: string;
  responseBodyTruncated?: boolean;
}

/** Validate one entry of a Metro `response-bodies` POST. */
export function isNetworkEventResponseBodyPatch(value: unknown): value is NetworkEventResponseBodyPatch {
  if (!value || typeof value !== "object") return false;
  const patch = value as Record<string, unknown>;
  return (
    typeof patch.id === "string" &&
    patch.id.trim() !== "" &&
    (patch.responseBodyPreview === undefined || typeof patch.responseBodyPreview === "string") &&
    (patch.responseBodyRef === undefined || typeof patch.responseBodyRef === "string")
  );
}

/** The fields a live page needs to update an existing hop row. */
export function responseBodyPatchFromNetworkEvent(event: NetworkEvent): NetworkEventResponseBodyPatch {
  return {
    id: event.id,
    requestId: event.requestId ?? undefined,
    responseBodyPreview: event.responseBodyPreview,
    responseBodyRef: event.responseBodyRef,
    responseBodyTruncated: event.responseBodyTruncated,
  };
}

function notifyListeners<T>(listeners: Set<(value: T) => void>, value: T): void {
  for (const listener of listeners) {
    try {
      listener(value);
    } catch {
      // listener must not break ingest
    }
  }
}

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
  private readonly patchListeners = new Set<MetroNetworkStreamListener>();
  private readonly maxEvents: number;

  constructor(maxEvents: number = DEFAULT_METRO_NETWORK_STREAM_MAX_EVENTS) {
    this.maxEvents = Math.max(1, maxEvents);
  }

  /** Append one hop (newest first). Notifies subscribers. */
  append(event: NetworkEvent): NetworkEvent {
    const slim = slimNetworkEventForMetroStream(event);
    const requestId = slim.requestId?.trim();
    if (requestId) {
      const existingIndex = this.events.findIndex(
        (existing) => existing.requestId?.trim() === requestId
      );
      if (existingIndex >= 0) {
        const merged = slimNetworkEventForMetroStream(
          mergeNetworkEventPreferRunnable(this.events[existingIndex], slim)
        );
        this.events.splice(existingIndex, 1);
        this.events.unshift(merged);
        if (this.events.length > this.maxEvents) {
          this.events.length = this.maxEvents;
        }
        this.publish(merged);
        return merged;
      }
    }
    this.events.unshift(slim);
    if (this.events.length > this.maxEvents) {
      this.events.length = this.maxEvents;
    }
    this.publish(slim);
    return slim;
  }

  private publish(event: NetworkEvent): void {
    notifyListeners(this.listeners, event);
  }

  /**
   * Fill in a buffered hop's response body in place (keeps its position).
   * Notifies patch subscribers, not hop subscribers, so live pages update the
   * existing row instead of adding a duplicate. Returns undefined when the hop is gone.
   */
  patchResponseBody(patch: NetworkEventResponseBodyPatch): NetworkEvent | undefined {
    const requestId = patch.requestId?.trim();
    let index = this.events.findIndex((event) => event.id === patch.id);
    if (index < 0 && requestId) {
      index = this.events.findIndex((event) => event.requestId?.trim() === requestId);
    }
    if (index < 0) return undefined;

    const current = this.events[index];
    const next = slimNetworkEventForMetroStream({
      ...current,
      responseBodyPreview: pickBodyPreview(current.responseBodyPreview, patch.responseBodyPreview),
      responseBodyRef: patch.responseBodyRef ?? current.responseBodyRef,
      responseBodyTruncated: patch.responseBodyTruncated ?? current.responseBodyTruncated,
    });
    this.events[index] = next;
    notifyListeners(this.patchListeners, next);
    return next;
  }

  subscribePatches(listener: MetroNetworkStreamListener): () => void {
    this.patchListeners.add(listener);
    return () => {
      this.patchListeners.delete(listener);
    };
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
  maxEvents?: number,
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
  maxPreviewBytes: number = DEFAULT_METRO_NETWORK_PREVIEW_BYTES,
): NetworkEvent {
  const slimPreview = (text: string | undefined): string | undefined => {
    if (text == null || text === "") return undefined;
    if (utf8ByteLength(text) <= maxPreviewBytes) return text;
    return truncateUtf8(text, maxPreviewBytes);
  };

  return {
    ...event,
    // Request headers stay: the live page rebuilds a runnable curl from them.
    responseHeaders: undefined,
    requestBodyPreview: slimPreview(event.requestBodyPreview),
    responseBodyPreview: slimPreview(event.responseBodyPreview),
  };
}

function isErrorHop(event: NetworkEvent): boolean {
  if (event.source === "error" || event.source === "blocked") return true;
  if (event.kind === "incident") return true;
  const status = event.status;
  if (typeof status === "number" && status >= 400) return true;
  const flags = event.anomalyFlags ?? [];
  return flags.some(
    (f) =>
      f === "http_error_status" ||
      f === "network_error" ||
      f === "graphql_errors" ||
      f.includes("error"),
  );
}

function isSlowHop(
  event: NetworkEvent,
  slowMs: number = DEFAULT_METRO_NETWORK_STREAM_SLOW_MS,
): boolean {
  if (typeof event.durationMs === "number" && event.durationMs >= slowMs)
    return true;
  return (event.anomalyFlags ?? []).includes("slow_response");
}

/** @public error hop heuristic for stream TTY / analyze. */
export function isMetroNetworkErrorHop(event: NetworkEvent): boolean {
  return isErrorHop(event);
}

/** @public slow hop heuristic for stream TTY / analyze. */
export function isMetroNetworkSlowHop(
  event: NetworkEvent,
  slowMs?: number,
): boolean {
  return isSlowHop(event, slowMs);
}

function percentile(sortedAsc: number[], p: number): number | undefined {
  if (sortedAsc.length === 0) return undefined;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx];
}

/** Summarize hops for interactive `a` analyze. */
export function analyzeMetroNetworkEvents(
  events: readonly NetworkEvent[],
  options?: { slowMs?: number; topN?: number },
): MetroNetworkStreamAnalysis {
  const slowMs = options?.slowMs ?? DEFAULT_METRO_NETWORK_STREAM_SLOW_MS;
  const topN = options?.topN ?? 8;
  const byHost: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  const durations: number[] = [];
  let errorCount = 0;
  let slowCount = 0;
  const slowHops: MetroNetworkStreamAnalysis["topSlow"] = [];
  const recentErrors: MetroNetworkStreamAnalysis["recentErrors"] = [];

  for (const e of events) {
    const host = e.host?.trim() || tryHostFromUrl(e.url) || "(unknown)";
    byHost[host] = (byHost[host] ?? 0) + 1;
    const source = e.source || "unknown";
    bySource[source] = (bySource[source] ?? 0) + 1;
    const method = (e.method || "?").toUpperCase();
    byMethod[method] = (byMethod[method] ?? 0) + 1;

    if (typeof e.durationMs === "number" && Number.isFinite(e.durationMs)) {
      durations.push(e.durationMs);
    }
    if (isErrorHop(e)) {
      errorCount += 1;
      if (recentErrors.length < topN) {
        recentErrors.push({
          method,
          path: e.path || e.url || "/",
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
        path: e.path || e.url || "/",
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
  const ts = event.timestamp ? event.timestamp.slice(11, 23) : "--:--:--.---";
  const method = (event.method || "?").toUpperCase().padEnd(6);
  const status =
    event.status != null
      ? String(event.status).padStart(3)
      : event.source === "error"
        ? "ERR"
        : "  -";
  const ms =
    typeof event.durationMs === "number" && Number.isFinite(event.durationMs)
      ? `${Math.round(event.durationMs)}ms`.padStart(7)
      : "      -";
  const source = (event.source || "").padEnd(10);
  const path = event.path || event.url || "/";
  const flags: string[] = [];
  if (isErrorHop(event)) flags.push("ERR");
  if (isSlowHop(event)) flags.push("SLOW");
  const screen = firstUsageScreen(event.usage);
  if (screen) flags.push(`screen=${screen}`);
  const flagStr = flags.length ? `  [${flags.join(" ")}]` : "";
  return `${ts}  ${method} ${status}  ${ms}  ${source}  ${path}${flagStr}`;
}

function firstUsageScreen(usage: NetworkEvent["usage"]): string | undefined {
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
  options?: { slowMs?: number },
): string {
  const slowMs = options?.slowMs ?? DEFAULT_METRO_NETWORK_STREAM_SLOW_MS;
  const lines: string[] = [
    `hops=${analysis.hopCount}  errors=${analysis.errorCount}  slow(≥${slowMs}ms)=${analysis.slowCount}`,
  ];
  if (analysis.p50DurationMs != null || analysis.p95DurationMs != null) {
    lines.push(
      `duration  p50=${analysis.p50DurationMs ?? "-"}ms  p95=${analysis.p95DurationMs ?? "-"}ms`,
    );
  }
  lines.push(`by source: ${formatCountMap(analysis.bySource)}`);
  lines.push(`by method: ${formatCountMap(analysis.byMethod)}`);
  const hosts = Object.entries(analysis.byHost)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([h, n]) => `${h}=${n}`)
    .join("  ");
  if (hosts) lines.push(`top hosts: ${hosts}`);
  if (analysis.topSlow.length > 0) {
    lines.push("slowest:");
    for (const s of analysis.topSlow) {
      lines.push(
        `  ${s.durationMs}ms  ${s.method} ${s.status ?? "-"}  ${s.path}  (${s.source})`,
      );
    }
  }
  if (analysis.recentErrors.length > 0) {
    lines.push("recent errors:");
    for (const e of analysis.recentErrors) {
      lines.push(`  ${e.method} ${e.status ?? "-"}  ${e.path}  (${e.source})`);
    }
  }
  return lines.join("\n");
}

function formatCountMap(map: Record<string, number>): string {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}=${n}`)
    .join("  ");
}

const DEFAULT_METRO_PORT = 8081;

export function resolveMetroNetworkStreamPort(explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  if (typeof process !== "undefined") {
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
  if (typeof process !== "undefined") {
    const raw = process.env.MOCKIFYER_METRO_STREAM?.trim().toLowerCase();
    if (raw === "off" || raw === "false" || raw === "0" || raw === "no") {
      return undefined;
    }
    if (raw === "on" || raw === "true" || raw === "1" || raw === "yes") {
      const explicitUrl = process.env.MOCKIFYER_METRO_URL?.trim();
      if (explicitUrl) {
        return trimTrailingSlashes(explicitUrl);
      }
      return `http://localhost:${resolveMetroNetworkStreamPort(options?.metroPort)}`;
    }
    const explicitUrl = process.env.MOCKIFYER_METRO_URL?.trim();
    if (explicitUrl) {
      return trimTrailingSlashes(explicitUrl);
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
    const nav =
      typeof navigator !== "undefined" ? (navigator as any) : undefined;
    if (nav?.product === "ReactNative") return true;
  } catch {
    // ignore
  }
  return false;
}

export function joinMetroNetworkEventsUrl(metroBaseUrl: string): string {
  return `${trimTrailingSlashes(metroBaseUrl)}/mockifyer-network-events`;
}

/** Metro POST path for response bodies the app deferred during an Atlas capture. */
export const METRO_RESPONSE_BODY_PATCHES_PATH = "/mockifyer-network-events/response-bodies";

export function joinMetroResponseBodyPatchesUrl(metroBaseUrl: string): string {
  return `${trimTrailingSlashes(metroBaseUrl)}${METRO_RESPONSE_BODY_PATCHES_PATH}`;
}

/**
 * Outbound/inbound header: caller's Metro hop-ingest base URL (no path).
 * Lets a BFF POST child hops into the same Atlas/Metro buffer as the device
 * without wrapping `mockifyerTrace` into API bodies.
 */
export const MOCKIFYER_METRO_STREAM_BASE_HEADER = "x-mockifyer-metro-stream-base";

const ATLAS_METRO_STREAM_ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "10.0.2.2",
  "[::1]",
  "::1",
]);

/**
 * Accept only loopback / Android-emulator Metro origins (SSRF guard).
 * Returns a trimmed base URL without a trailing slash, or undefined.
 */
export function sanitizeAtlasMetroStreamBaseUrl(
  raw: string | null | undefined
): string | undefined {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    const host = parsed.hostname.toLowerCase();
    if (!ATLAS_METRO_STREAM_ALLOWED_HOSTS.has(host)) {
      return undefined;
    }
    parsed.hash = "";
    parsed.search = "";
    // Path must be empty or `/` — ingest joins `/mockifyer-network-events`.
    if (parsed.pathname && parsed.pathname !== "/") {
      return undefined;
    }
    return trimTrailingSlashes(parsed.origin);
  } catch {
    return undefined;
  }
}

/** Metro GET path for Atlas `t` capture session state (device polls this). */
export const ATLAS_CAPTURE_SESSION_PATH = "/mockifyer-atlas-capture";

export function joinMetroAtlasCaptureSessionUrl(metroBaseUrl: string): string {
  return `${trimTrailingSlashes(metroBaseUrl)}${ATLAS_CAPTURE_SESSION_PATH}`;
}

const ATLAS_CAPTURE_SESSION_GLOBAL = Symbol.for(
  "@sgedda/mockifyer-core.metroAtlasCaptureSession",
);

/** How often the device re-checks Metro for Atlas `t` capture state. */
export const METRO_ATLAS_CAPTURE_SYNC_TTL_MS = 400;

interface MetroAtlasCaptureSessionState {
  /** True while Metro Atlas capture (`t`) is active, or last known from Metro. */
  active: boolean;
  lastSyncedAtMs: number;
  /** Shared in-flight refresh so concurrent outbound calls wait for the same GET. */
  refreshPromise?: Promise<void>;
  /** Called when `active` flips (capture started or stopped). */
  listeners?: Set<(active: boolean) => void>;
}

function getMetroAtlasCaptureSessionState(): MetroAtlasCaptureSessionState {
  const globalStore = globalThis as typeof globalThis & {
    [ATLAS_CAPTURE_SESSION_GLOBAL]?: MetroAtlasCaptureSessionState;
  };
  if (!globalStore[ATLAS_CAPTURE_SESSION_GLOBAL]) {
    globalStore[ATLAS_CAPTURE_SESSION_GLOBAL] = {
      active: false,
      lastSyncedAtMs: 0,
    };
  }
  return globalStore[ATLAS_CAPTURE_SESSION_GLOBAL];
}

/** Metro middleware / device: mark whether an Atlas `t` capture session is running. */
export function setMetroAtlasCaptureSessionActive(active: boolean): void {
  const state = getMetroAtlasCaptureSessionState();
  const next = active === true;
  const changed = state.active !== next;
  state.active = next;
  state.lastSyncedAtMs = Date.now();
  if (changed && state.listeners) {
    notifyListeners(state.listeners, next);
  }
}

/** Subscribe to Atlas `t` capture start / stop as last seen from Metro. */
export function onMetroAtlasCaptureSessionChange(listener: (active: boolean) => void): () => void {
  const state = getMetroAtlasCaptureSessionState();
  state.listeners ??= new Set();
  state.listeners.add(listener);
  return () => {
    state.listeners?.delete(listener);
  };
}

/**
 * Whether an Atlas `t` capture session is active (Metro live buffer / UI).
 * While active, outbound hops stamp include-trace unless
 * `networkLog.includeTraceHeader` is explicitly `false`.
 */
export function isMetroAtlasCaptureSessionActive(): boolean {
  return getMetroAtlasCaptureSessionState().active === true;
}

/**
 * Run `task` as the shared capture-session refresh (deduped while in flight).
 * With `force: false`, skips when the last sync is within the TTL.
 */
export async function runMetroAtlasCaptureSessionRefresh(
  task: () => Promise<void>,
  options?: { force?: boolean; ttlMs?: number }
): Promise<void> {
  const state = getMetroAtlasCaptureSessionState();
  if (state.refreshPromise) {
    await state.refreshPromise;
    return;
  }
  const ttlMs = options?.ttlMs ?? METRO_ATLAS_CAPTURE_SYNC_TTL_MS;
  if (!options?.force && Date.now() - state.lastSyncedAtMs < ttlMs) {
    return;
  }
  let pending!: Promise<void>;
  pending = (async () => {
    try {
      await task();
    } finally {
      const current = getMetroAtlasCaptureSessionState();
      // Update lastSyncedAtMs even on failure so the TTL prevents immediate retries
      // when Metro is unreachable. Successful task calls setMetroAtlasCaptureSessionActive,
      // which also updates this timestamp, but failures must update it too.
      current.lastSyncedAtMs = Date.now();
      if (current.refreshPromise === pending) {
        current.refreshPromise = undefined;
      }
    }
  })();
  state.refreshPromise = pending;
  await pending;
}

/**
 * Metro Atlas session status (phase / activateMockifyer) for app-side runtime sync.
 * Same resource as {@link joinMetroAtlasCaptureSessionUrl}.
 */
export function joinMetroAtlasSessionUrl(metroBaseUrl: string): string {
  return joinMetroAtlasCaptureSessionUrl(metroBaseUrl);
}
