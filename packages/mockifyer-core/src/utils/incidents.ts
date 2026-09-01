import type { MockifyerConfig } from '../types';
import type { IncidentType, NetworkEvent } from './network-event-types';
import { buildNetworkEvent } from './network-log';
import { randomEventId, truncateUtf8, utf8ByteLength } from './crypto-digest';
import {
  configureFlightRecorder,
  getRecentFlightHops,
  getRecentFlightIncidents,
  recordFlightIncidentEvent,
  resolveFlightRecorderConfig,
  setFlightRecorderRuntimeContext,
} from './flight-recorder';
import {
  detectResponseAnomalies,
  type ResponseAnomalyFlag,
} from './response-shape';
import {
  emitNetworkLogEvent,
  resolveNetworkLogCaptureBodies,
  resolveNetworkLogDashboardUrl,
} from './network-log';
import { enrichNetworkEventsWithAtlasUsage } from './atlas-usage';
import { formatHopLineForDisplay, primaryScreenForHop } from './hop-display';

export interface CrashSuspect {
  eventId: string;
  requestId?: string | null;
  method: string;
  url: string;
  status?: number;
  source: NetworkEvent['source'];
  flags: ResponseAnomalyFlag[];
  summary: string;
}

export interface CrashContext {
  incident: NetworkEvent;
  hops: NetworkEvent[];
  /** Hop ids included via prefetch grace (different session, recent). */
  prefetchHopIds?: string[];
  suspects: CrashSuspect[];
  windowMs: number;
  prefetchGraceMs?: number;
}

export interface GetCrashContextOptions {
  incidentId?: string;
  sessionId?: string | null;
  clientId?: string | null;
  at?: string;
  windowMs?: number;
  hopLimit?: number;
  /**
   * When `sessionId` is set, also include hops from other sessions within this many ms
   * before the incident (or before the first same-session hop). Catches parent prefetches
   * without manual flow wiring. Default 5000 when sessionId is set; 0 otherwise.
   */
  prefetchGraceMs?: number;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_PREFETCH_GRACE_MS = 5_000;
const MAX_STACK_PREVIEW_BYTES = 4_096;

export type { IncidentType };

export interface ReportIncidentInput {
  type: IncidentType;
  message: string;
  stack?: string;
  componentStack?: string;
  sessionId?: string | null;
  clientId?: string | null;
  scenario?: string;
  at?: string;
}

function truncateStack(text: string | undefined): string | undefined {
  if (!text?.trim()) return undefined;
  if (utf8ByteLength(text) <= MAX_STACK_PREVIEW_BYTES) return text;
  return truncateUtf8(text, MAX_STACK_PREVIEW_BYTES);
}

export function incidentToNetworkEvent(
  input: ReportIncidentInput,
  runtime?: { sessionId?: string | null; clientId?: string | null; scenario?: string }
): NetworkEvent {
  const at = input.at ?? new Date().toISOString();
  const sessionId = input.sessionId ?? runtime?.sessionId ?? null;
  const clientId = input.clientId ?? runtime?.clientId ?? null;
  const scenario = input.scenario ?? runtime?.scenario ?? 'default';

  return buildNetworkEvent({
    id: randomEventId(),
    timestamp: at,
    kind: 'incident',
    incidentType: input.type,
    scenario,
    sessionId,
    clientId,
    transport: 'app',
    method: 'INCIDENT',
    url: `app://${input.type}`,
    source: 'error',
    errorMessage: input.message,
    stackPreview: truncateStack(input.stack),
    componentStackPreview: truncateStack(input.componentStack),
  });
}

function flagSummary(flags: ResponseAnomalyFlag[]): string {
  if (flags.length === 0) return 'No heuristic flags';
  return flags.join(', ');
}

function buildSuspects(hops: NetworkEvent[]): CrashSuspect[] {
  const suspects: CrashSuspect[] = [];

  for (const hop of hops) {
    let responseBody: unknown;
    if (hop.responseBodyPreview) {
      try {
        responseBody = JSON.parse(hop.responseBodyPreview);
      } catch {
        responseBody = hop.responseBodyPreview;
      }
    }

    const flags = detectResponseAnomalies({
      status: hop.status,
      source: hop.source,
      durationMs: hop.durationMs,
      responseBody,
    });

    const anomalyFlags = hop.anomalyFlags ?? [];
    for (const flag of anomalyFlags) {
      if (!flags.includes(flag as ResponseAnomalyFlag)) {
        flags.push(flag as ResponseAnomalyFlag);
      }
    }

    if (flags.length === 0) continue;

    suspects.push({
      eventId: hop.id,
      requestId: hop.requestId,
      method: hop.method,
      url: hop.url,
      status: hop.status,
      source: hop.source,
      flags,
      summary: flagSummary(flags),
    });
  }

  return suspects;
}

function resolvePrefetchGraceMs(options: GetCrashContextOptions, sessionId?: string | null): number {
  if (options.prefetchGraceMs !== undefined) {
    return Math.max(0, options.prefetchGraceMs);
  }
  return sessionId?.trim() ? DEFAULT_PREFETCH_GRACE_MS : 0;
}

function filterHopsInTimeWindow(
  hops: NetworkEvent[],
  options: {
    clientId?: string | null;
    sinceMs?: number;
    beforeMs?: number;
  }
): NetworkEvent[] {
  return hops.filter((hop) => {
    if ((hop.kind ?? 'network') === 'incident') return false;
    if (options.clientId && (hop.clientId ?? '') !== options.clientId) return false;
    const ts = Date.parse(hop.timestamp);
    if (Number.isFinite(options.sinceMs) && Number.isFinite(ts) && ts < options.sinceMs!) {
      return false;
    }
    if (Number.isFinite(options.beforeMs) && Number.isFinite(ts) && ts > options.beforeMs!) {
      return false;
    }
    return true;
  });
}

/**
 * All hops in the time window, ranked most-relevant first (suspects → same session → prefetch → recency).
 * Session id boosts ranking; it no longer excludes other hops in the window.
 */
export function collectCrashContextHops(
  candidateHops: NetworkEvent[],
  options: {
    sessionId?: string | null;
    clientId?: string | null;
    atMs: number;
    windowMs: number;
    prefetchGraceMs?: number;
    hopLimit?: number;
  }
): { hops: NetworkEvent[]; prefetchHopIds: string[]; prefetchGraceMs: number } {
  const hopLimit = options.hopLimit ?? 50;
  const windowMs = options.windowMs;
  const prefetchGraceMs = options.prefetchGraceMs ?? 0;
  const sinceMs = Number.isFinite(options.atMs) ? options.atMs - windowMs : undefined;
  const beforeMs = Number.isFinite(options.atMs) ? options.atMs + 1 : undefined;

  const inWindow = filterHopsInTimeWindow(candidateHops, {
    clientId: options.clientId,
    sinceMs,
    beforeMs,
  });

  const sessionId = options.sessionId?.trim();
  const prefetchHopIds: string[] = [];
  if (sessionId && prefetchGraceMs > 0 && Number.isFinite(options.atMs)) {
    const graceSince = options.atMs - prefetchGraceMs;
    for (const hop of inWindow) {
      if ((hop.sessionId ?? '') === sessionId) continue;
      const ts = Date.parse(hop.timestamp);
      if (Number.isFinite(ts) && ts >= graceSince && ts <= options.atMs) {
        prefetchHopIds.push(hop.id);
      }
    }
  }

  const suspects = buildSuspects(inWindow);
  const sorted = sortHopsByRelevance(inWindow, {
    suspects,
    prefetchHopIds,
    sessionId,
    atMs: options.atMs,
    windowMs,
  });
  const hops = sorted.slice(0, hopLimit);

  return {
    hops,
    prefetchHopIds: prefetchHopIds.filter((id) => hops.some((h) => h.id === id)),
    prefetchGraceMs: sessionId ? prefetchGraceMs : 0,
  };
}

export interface SortHopsByRelevanceOptions {
  suspects?: CrashSuspect[];
  prefetchHopIds?: string[];
  sessionId?: string | null;
  atMs: number;
  windowMs: number;
}

/** Most relevant first: flagged suspects, then same-session, prefetch, then recency. */
export function sortHopsByRelevance(
  hops: NetworkEvent[],
  options: SortHopsByRelevanceOptions
): NetworkEvent[] {
  const suspectIds = new Set((options.suspects ?? []).map((s) => s.eventId));
  const prefetchIds = new Set(options.prefetchHopIds ?? []);
  const sessionId = options.sessionId?.trim();

  const score = (hop: NetworkEvent): number => {
    let value = 0;
    if (suspectIds.has(hop.id) || (hop.anomalyFlags?.length ?? 0) > 0) {
      value += 1000;
    }
    if (sessionId && (hop.sessionId ?? '') === sessionId) {
      value += 100;
    }
    if (prefetchIds.has(hop.id)) {
      value += 50;
    }
    const ts = Date.parse(hop.timestamp);
    if (Number.isFinite(ts) && Number.isFinite(options.atMs)) {
      const age = Math.max(0, options.atMs - ts);
      const window = Math.max(1, options.windowMs);
      value += Math.round(49 * (1 - Math.min(age, window) / window));
    }
    return value;
  };

  return [...hops].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });
}

function orderSuspectsLikeHops(suspects: CrashSuspect[], hops: NetworkEvent[]): CrashSuspect[] {
  const rank = new Map(hops.map((h, index) => [h.id, index]));
  return [...suspects].sort(
    (a, b) => (rank.get(a.eventId) ?? 9999) - (rank.get(b.eventId) ?? 9999)
  );
}

function finalizeCrashContext(
  incident: NetworkEvent,
  candidateHops: NetworkEvent[],
  options: GetCrashContextOptions
): CrashContext {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const at = options.at ?? incident.timestamp;
  const atMs = Date.parse(at);
  const sessionId = options.sessionId ?? incident.sessionId;
  const prefetchGraceMs = resolvePrefetchGraceMs(options, sessionId);

  const { hops, prefetchHopIds } = collectCrashContextHops(candidateHops, {
    sessionId,
    clientId: options.clientId ?? incident.clientId,
    atMs,
    windowMs,
    prefetchGraceMs,
    hopLimit: options.hopLimit,
  });

  const enrichedHops = enrichNetworkEventsWithAtlasUsage(hops);
  const suspects = orderSuspectsLikeHops(buildSuspects(enrichedHops), enrichedHops);

  return {
    incident,
    hops: enrichedHops,
    prefetchHopIds,
    suspects,
    windowMs,
    prefetchGraceMs,
  };
}

function findIncidentById(incidentId: string): NetworkEvent | undefined {
  return getRecentFlightIncidents({ limit: 500 }).find((e) => e.id === incidentId);
}

export function getCrashContext(options: GetCrashContextOptions): CrashContext | null {
  const fromLocal = getCrashContextFromLocalBuffer(options);
  if (fromLocal) return fromLocal;
  return null;
}

export function explainIncidentFromEvents(
  events: NetworkEvent[],
  options: GetCrashContextOptions
): CrashContext | null {
  let incident: NetworkEvent | undefined;
  if (options.incidentId) {
    incident = events.find((e) => e.id === options.incidentId && e.kind === 'incident');
  } else {
    const atMsForSearch = options.at ? Date.parse(options.at) : Number.NaN;
    incident = events
      .filter((e) => e.kind === 'incident')
      .filter((e) => {
        if (options.sessionId && (e.sessionId ?? '') !== options.sessionId) return false;
        if (options.clientId && (e.clientId ?? '') !== options.clientId) return false;
        const ts = Date.parse(e.timestamp);
        if (Number.isFinite(atMsForSearch) && Number.isFinite(ts) && ts > atMsForSearch) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  }

  if (!incident) return null;

  const at = options.at ?? incident.timestamp;
  const atMs = Date.parse(at);
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const prefetchGraceMs = resolvePrefetchGraceMs(options, options.sessionId ?? incident.sessionId);
  const sinceMs = Number.isFinite(atMs) ? atMs - windowMs : undefined;
  const networkCandidates = events.filter((e) => (e.kind ?? 'network') === 'network');
  const inScanWindow = filterHopsInTimeWindow(networkCandidates, {
    clientId: options.clientId ?? incident.clientId,
    sinceMs,
    beforeMs: Number.isFinite(atMs) ? atMs + 1 : undefined,
  });

  return finalizeCrashContext(incident, inScanWindow, options);
}

function getCrashContextFromLocalBuffer(options: GetCrashContextOptions): CrashContext | null {
  let incident: NetworkEvent | undefined;
  if (options.incidentId) {
    incident = findIncidentById(options.incidentId);
  } else {
    const atMsForSearch = options.at ? Date.parse(options.at) : Number.NaN;
    const recent = getRecentFlightIncidents({
      sessionId: options.sessionId,
      clientId: options.clientId,
      beforeMs: Number.isFinite(atMsForSearch) ? atMsForSearch + 1 : undefined,
      limit: 1,
    });
    incident = recent[0];
  }

  if (!incident) return null;

  const at = options.at ?? incident.timestamp;
  const atMs = Date.parse(at);
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const prefetchGraceMs = resolvePrefetchGraceMs(options, options.sessionId ?? incident.sessionId);
  const sinceMs = Number.isFinite(atMs) ? atMs - windowMs : undefined;

  const candidateHops = getRecentFlightHops({
    clientId: options.clientId ?? incident.clientId,
    sinceMs,
    beforeMs: Number.isFinite(atMs) ? atMs + 1 : undefined,
    limit: 500,
  });

  return finalizeCrashContext(incident, candidateHops, options);
}

export interface ReportIncidentOptions {
  config?: Pick<MockifyerConfig, 'networkLog' | 'proxy'>;
  scenario?: string;
  clientId?: string;
  sessionId?: string;
  postToDashboard?: boolean;
}

function shouldPostIncident(config?: Pick<MockifyerConfig, 'networkLog' | 'proxy'>): boolean {
  if (config?.networkLog?.incidents?.enabled === false) return false;
  if (config?.networkLog?.incidents?.postToDashboard === false) return false;
  return Boolean(resolveNetworkLogDashboardUrl(config ?? {}));
}

export function reportIncident(
  input: ReportIncidentInput,
  options: ReportIncidentOptions = {}
): NetworkEvent {
  const recorderConfig = options.config ? resolveFlightRecorderConfig(options.config) : undefined;
  if (recorderConfig) {
    configureFlightRecorder(recorderConfig);
  }

  const enriched: ReportIncidentInput = {
    ...input,
    scenario: input.scenario ?? options.scenario,
    clientId: input.clientId ?? options.clientId ?? null,
    sessionId: input.sessionId ?? options.sessionId ?? null,
  };

  const contextUpdate: {
    scenario?: string;
    clientId?: string;
    sessionId?: string;
  } = {};
  if (enriched.scenario !== undefined) {
    contextUpdate.scenario = enriched.scenario;
  }
  if (enriched.clientId !== null && enriched.clientId !== undefined) {
    contextUpdate.clientId = enriched.clientId;
  }
  if (enriched.sessionId !== null && enriched.sessionId !== undefined) {
    contextUpdate.sessionId = enriched.sessionId;
  }
  if (Object.keys(contextUpdate).length > 0) {
    setFlightRecorderRuntimeContext(contextUpdate);
  }

  const event =
    recordFlightIncidentEvent(
      incidentToNetworkEvent(enriched, {
        sessionId: enriched.sessionId,
        clientId: enriched.clientId,
        scenario: enriched.scenario,
      })
    ) ??
    incidentToNetworkEvent(enriched, {
      sessionId: enriched.sessionId,
      clientId: enriched.clientId,
      scenario: enriched.scenario,
    });

  if (options.postToDashboard !== false && shouldPostIncident(options.config)) {
    const dashboardBaseUrl = resolveNetworkLogDashboardUrl(options.config ?? {});
    if (dashboardBaseUrl) {
      emitNetworkLogEvent({
        dashboardBaseUrl,
        captureBodies: resolveNetworkLogCaptureBodies(options.config ?? {}),
        event,
      });
    }
  }

  return event;
}

export interface InstallCrashHooksOptions extends ReportIncidentOptions {
  /** When true (default), register window/process hooks. No-op when globals are missing. */
  registerGlobals?: boolean;
}

/** Max wait for the incident POST before exiting after an uncaught exception. */
const UNCAUGHT_EXIT_FLUSH_TIMEOUT_MS = 2000;

/** Collapse process + DOM reports of the same rejection into one incident. */
const CRASH_REPORT_DEDUPE_MS = 250;

let hooksInstalled = false;
let uninstallHooks: (() => void) | null = null;

/** Best-effort global hooks for async / Node crashes. Safe to call multiple times. */
export function installMockifyerCrashHooks(options: InstallCrashHooksOptions = {}): () => void {
  if (hooksInstalled && uninstallHooks) {
    return uninstallHooks;
  }

  const handlers: Array<() => void> = [];
  let lastReportKey = '';
  let lastReportAt = 0;

  /**
   * Records locally always; POSTs to the dashboard when configured and returns a
   * promise that settles when that POST finishes (or immediately if skipped).
   */
  const report = async (
    type: ReportIncidentInput['type'],
    error: unknown
  ): Promise<void> => {
    try {
      const err = error instanceof Error ? error : new Error(String(error));
      const key = `${type}:${err.message}:${(err.stack ?? '').slice(0, 200)}`;
      const now = Date.now();
      if (key === lastReportKey && now - lastReportAt < CRASH_REPORT_DEDUPE_MS) {
        return;
      }
      lastReportKey = key;
      lastReportAt = now;

      const event = reportIncident(
        {
          type,
          message: err.message || String(error),
          stack: err.stack,
        },
        { ...options, postToDashboard: false }
      );

      if (options.postToDashboard === false || !shouldPostIncident(options.config)) {
        return;
      }

      const dashboardBaseUrl = resolveNetworkLogDashboardUrl(options.config ?? {});
      if (!dashboardBaseUrl) {
        return;
      }

      await emitNetworkLogEvent({
        dashboardBaseUrl,
        captureBodies: resolveNetworkLogCaptureBodies(options.config ?? {}),
        event,
      });
    } catch {
      // observability must never throw
    }
  };

  if (options.registerGlobals !== false) {
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as typeof globalThis & {
        addEventListener?: (type: string, listener: (ev: Event) => void) => void;
        removeEventListener?: (type: string, listener: (ev: Event) => void) => void;
        onunhandledrejection?: ((ev: PromiseRejectionEvent) => void) | null;
        onerror?: OnErrorEventHandler;
      };

      // Register both when available. RN / Electron / jsdom often expose process.on
      // while promise rejections still surface as globalThis `unhandledrejection`.
      if (typeof process !== 'undefined' && typeof process.on === 'function') {
        const onUnhandled = (reason: unknown): void => {
          void report('unhandledrejection', reason);
        };
        const onUncaught = (error: Error): void => {
          void (async () => {
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            try {
              await Promise.race([
                report('uncaught_exception', error),
                new Promise<void>((resolve) => {
                  timeoutId = setTimeout(resolve, UNCAUGHT_EXIT_FLUSH_TIMEOUT_MS);
                }),
              ]);
            } finally {
              if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
              }
            }
            process.exit(1);
          })();
        };
        process.on('unhandledRejection', onUnhandled);
        process.on('uncaughtException', onUncaught);
        handlers.push(() => {
          process.off('unhandledRejection', onUnhandled);
          process.off('uncaughtException', onUncaught);
        });
      }

      if (typeof g.addEventListener === 'function') {
        const onRejection = (ev: Event): void => {
          const reason = (ev as PromiseRejectionEvent).reason;
          void report('unhandledrejection', reason);
        };
        g.addEventListener('unhandledrejection', onRejection);
        handlers.push(() => g.removeEventListener?.('unhandledrejection', onRejection));
      }
    }
  }

  uninstallHooks = (): void => {
    for (const off of handlers) {
      try {
        off();
      } catch {
        // ignore
      }
    }
    hooksInstalled = false;
    uninstallHooks = null;
  };

  hooksInstalled = true;
  return uninstallHooks;
}

export interface LogCompactIncidentOptions {
  error: Error;
  incidentId?: string | null;
  crashContext?: CrashContext | null;
}

/** Metro / LogBox often hides `console.groupCollapsed` children — use flat lines instead. */
function prefersFlatConsoleHopLog(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as { product?: string }).product === 'ReactNative'
  );
}

const MAX_CONSOLE_HOPS = 12;

/**
 * One-line error in the console; hop details inside a collapsed group (Chrome / Node)
 * or as flat warn lines (React Native / Metro).
 */
export function logCompactIncidentToConsole(options: LogCompactIncidentOptions): void {
  if (typeof console === 'undefined') return;

  const { error, incidentId, crashContext } = options;
  const suspectCount = crashContext?.suspects.length ?? 0;
  const hopCount = crashContext?.hops.length ?? 0;
  const idSuffix = incidentId ? ` [${incidentId}]` : '';

  console.error(`[Mockifyer]${idSuffix} ${error.message}`);

  if (!crashContext || (hopCount === 0 && suspectCount === 0)) {
    if (error.stack) {
      console.error(error.stack);
    }
    return;
  }

  const groupLabel =
    suspectCount > 0
      ? `[Mockifyer] Network context — ${hopCount} hops, ${suspectCount} flagged (ranked)`
      : `[Mockifyer] Network context — ${hopCount} hops (ranked)`;

  const logHopLine = (line: string): void => {
    if (typeof console.warn === 'function') {
      console.warn(line);
    } else {
      console.error(line);
    }
  };

  const printHopDetails = (): void => {
    if (crashContext!.incident.sessionId) {
      logHopLine(`[Mockifyer] sessionId: ${crashContext!.incident.sessionId}`);
    }
    if (suspectCount > 0) {
      for (const s of crashContext!.suspects) {
        logHopLine(`[Mockifyer] ⚠ ${s.method} ${s.url} — ${s.summary}`);
      }
    }
    const hopsToShow = crashContext!.hops.slice(0, MAX_CONSOLE_HOPS);
    let lastScreen: string | undefined;
    for (const hop of hopsToShow) {
      const screen = primaryScreenForHop(hop);
      if (screen && screen !== lastScreen) {
        logHopLine(`[Mockifyer] — ${screen} —`);
        lastScreen = screen;
      }
      const isPrefetch = crashContext!.prefetchHopIds?.includes(hop.id);
      logHopLine(`[Mockifyer]   ${isPrefetch ? '(prefetch) ' : ''}${formatHopLineForDisplay(hop)}`);
    }
    if (hopCount > MAX_CONSOLE_HOPS) {
      logHopLine(`[Mockifyer]   … +${hopCount - MAX_CONSOLE_HOPS} more (see on-screen fallback)`);
    }
  };

  if (prefersFlatConsoleHopLog()) {
    logHopLine(groupLabel);
    printHopDetails();
  } else if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(groupLabel);
    printHopDetails();
    if (typeof console.groupEnd === 'function') {
      console.groupEnd();
    }
  } else {
    logHopLine(groupLabel);
    printHopDetails();
  }

  if (error.stack) {
    console.error(error.stack);
  }
}

export function explainCrashContext(context: CrashContext): string {
  const lines: string[] = [];
  lines.push(`Incident: ${context.incident.incidentType ?? 'unknown'} — ${context.incident.errorMessage ?? ''}`);
  lines.push(`At: ${context.incident.timestamp}`);
  if (context.incident.sessionId) {
    lines.push(`Session: ${context.incident.sessionId}`);
  }
  lines.push(`Window: ${context.windowMs}ms before incident`);
  lines.push(`Hops: ${context.hops.length}`);

  if (context.suspects.length > 0) {
    lines.push('Suspects:');
    for (const suspect of context.suspects.slice(0, 10)) {
      lines.push(
        `  - ${suspect.method} ${suspect.url} (${suspect.source}${suspect.status != null ? ` ${suspect.status}` : ''}): ${suspect.summary}`
      );
    }
  } else {
    lines.push('Suspects: none flagged by heuristics');
  }

  return lines.join('\n');
}

export function resolveCrashContextUrl(
  dashboardBaseUrl: string,
  params: { incidentId?: string; sessionId?: string; at?: string; windowMs?: number }
): string {
  const base = dashboardBaseUrl.trim().replace(/\/+$/, '');
  const qs = new URLSearchParams();
  if (params.incidentId) qs.set('incidentId', params.incidentId);
  if (params.sessionId) qs.set('sessionId', params.sessionId);
  if (params.at) qs.set('at', params.at);
  if (params.windowMs != null) qs.set('windowMs', String(params.windowMs));
  const suffix = qs.toString();
  return `${base}/api/network-events/explain${suffix ? `?${suffix}` : ''}`;
}
