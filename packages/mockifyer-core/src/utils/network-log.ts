import { ENV_VARS, type MockifyerConfig } from '../types';
import { randomEventId, sha256Hex, truncateUtf8, utf8ByteLength } from './crypto-digest';
import {
  configureFlightRecorder,
  recordFlightNetworkEvent,
  resolveFlightRecorderConfig,
} from './flight-recorder';
import {
  detectResponseAnomalies,
  responseShapeFingerprint,
} from './response-shape';

export type {
  IncidentType,
  MockMatchMode,
  NetworkEvent,
  NetworkEventPhase,
  NetworkEventSource,
  NetworkEventTransport,
  NetworkEventUsage,
  TimelineEventKind,
} from './network-event-types';
import type { NetworkEvent, NetworkEventTransport } from './network-event-types';
import { resolveUsageForNetworkEmit } from './atlas-usage';
import { getAtlasUsageDashboardBaseUrl } from './atlas-usage';
import { rememberAtlasHtmlNetworkEvent, getAtlasDocHtmlOutputPath } from './atlas-doc-html';
import {
  NETWORK_BODY_SPILL_MAX_BYTES,
  NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES,
  scheduleNetworkBodySpill,
  serializeBodyForSpill,
  serializeBodyText,
  setNetworkBodySpillEnabled,
} from './network-body-spill';
import { prettyPrintJsonText } from './json-pretty';
import {
  formatGraphqlRequestBodyObject,
  isGraphqlRequestBodyObject,
} from './graphql-body-display';
import { resolveUnpatchedFetch } from './unpatched-global-fetch';
import {
  joinMetroNetworkEventsUrl,
  resolveMetroNetworkStreamBaseUrl,
} from './metro-network-stream';

export { prettyPrintJsonText, softPrettyJsonText } from './json-pretty';

export interface NetworkLogEmitterOptions {
  /** Dashboard origin + optional path prefix (same as `proxy.baseUrl`). */
  dashboardBaseUrl: string;
  event: Omit<NetworkEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string };
  captureBodies?: boolean;
}

const DEFAULT_REDACT_HEADER_NAMES = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
];

const SENSITIVE_QUERY_PARAMS = ['api_key', 'apikey', 'token', 'access_token', 'password', 'secret'];

export const NETWORK_LOG_DEFAULT_MAX_EVENT_BYTES = 8_192;
export const NETWORK_LOG_DEFAULT_MAX_EVENTS = 5_000;
export const NETWORK_LOG_DEFAULT_TTL_SEC = 60 * 60 * 24;

export function parseNetworkLogIntEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function newEventId(): string {
  return randomEventId();
}

/** Redact sensitive header values (case-insensitive names). */
export function redactHeaders(
  headers: Record<string, string> | undefined,
  extraRedactNames: string[] = []
): Record<string, string> | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const redact = new Set(
    [...DEFAULT_REDACT_HEADER_NAMES, ...extraRedactNames].map((h) => h.toLowerCase())
  );
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = redact.has(k.toLowerCase()) ? '[REDACTED]' : String(v);
  }
  return out;
}

/** Mask common secret query params in the query string. */
export function sanitizeQueryString(query: string | undefined): string | undefined {
  if (!query || !query.trim()) return query;
  const trimmed = query.startsWith('?') ? query.slice(1) : query;
  try {
    const params = new URLSearchParams(trimmed);
    let changed = false;
    for (const key of [...params.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.includes(key.toLowerCase())) {
        params.set(key, '[REDACTED]');
        changed = true;
      }
    }
    if (!changed) return query;
    const next = params.toString();
    return query.startsWith('?') ? `?${next}` : next;
  } catch {
    return query;
  }
}

/** Mask common secret query params in the full URL stored on network events. */
export function sanitizeUrlString(url: string): string {
  if (!url.trim()) return url;

  try {
    const parsed = new URL(url);
    const query = sanitizeQueryString(parsed.search || undefined);
    if (query !== undefined) {
      parsed.search = query;
    }
    return parsed.toString();
  } catch {
    const hashIndex = url.indexOf('#');
    const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
    const queryIndex = beforeHash.indexOf('?');
    if (queryIndex === -1) return url;

    const prefix = beforeHash.slice(0, queryIndex);
    const query = beforeHash.slice(queryIndex + 1);
    return `${prefix}?${sanitizeQueryString(query) ?? query}${hash}`;
  }
}

/** Serialize a request/response payload for network log previews (truncated by {@link sanitizeNetworkEvent}). */
export function toNetworkLogBodyPreview(
  value: unknown,
  maxBytes: number = NETWORK_LOG_DEFAULT_MAX_EVENT_BYTES
): string | undefined {
  return truncatePreview(value, maxBytes);
}

function truncatePreview(value: unknown, maxBytes: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  let text: string;
  if (typeof value === 'string') {
    text = prettyPrintJsonText(value);
  } else {
    try {
      if (isGraphqlRequestBodyObject(value)) {
        text = formatGraphqlRequestBodyObject(value);
      } else {
        text = JSON.stringify(value, null, 2);
      }
    } catch {
      text = String(value);
    }
  }
  if (utf8ByteLength(text) <= maxBytes) return text;
  return truncateUtf8(text, maxBytes);
}

export interface SanitizeNetworkEventOptions {
  captureBodies?: boolean;
  maxEventBytes?: number;
  extraRedactHeaders?: string[];
}

/** Apply privacy guardrails before persisting or POSTing an event. */
export function sanitizeNetworkEvent(
  input: NetworkEvent,
  options: SanitizeNetworkEventOptions = {}
): NetworkEvent {
  const maxBytes = options.maxEventBytes ?? NETWORK_LOG_DEFAULT_MAX_EVENT_BYTES;
  const captureBodies = options.captureBodies === true;
  const inlineBodyBytes = Math.min(NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES, maxBytes);

  let host: string | undefined;
  let path: string | undefined;
  let query: string | undefined;
  try {
    const u = new URL(input.url);
    host = u.host;
    path = u.pathname;
    query = sanitizeQueryString(u.search || undefined);
  } catch {
    // keep url as-is
  }

  const event: NetworkEvent = {
    ...input,
    id: input.id || newEventId(),
    timestamp: input.timestamp || new Date().toISOString(),
    url: sanitizeUrlString(input.url),
    host: input.host ?? host,
    path: input.path ?? path,
    query: input.query !== undefined ? sanitizeQueryString(input.query) : query,
    requestHeaders: redactHeaders(input.requestHeaders, options.extraRedactHeaders),
    responseHeaders: redactHeaders(input.responseHeaders, options.extraRedactHeaders),
    requestBodyPreview: captureBodies
      ? truncatePreview(input.requestBodyPreview, inlineBodyBytes)
      : undefined,
    responseBodyPreview: captureBodies
      ? truncatePreview(input.responseBodyPreview, inlineBodyBytes)
      : undefined,
    // Refs survive even when previews shrink — download uses disk/Metro spill.
    requestBodyRef: captureBodies ? input.requestBodyRef : undefined,
    responseBodyRef: captureBodies ? input.responseBodyRef : undefined,
    requestBodyTruncated: captureBodies ? input.requestBodyTruncated : undefined,
    responseBodyTruncated: captureBodies ? input.responseBodyTruncated : undefined,
  };

  if (utf8ByteLength(JSON.stringify(event)) <= maxBytes) {
    return event;
  }

  // Prefer keeping short body previews + refs; drop bulky headers first.
  const withoutHeaders: NetworkEvent = {
    ...event,
    requestHeaders: undefined,
    responseHeaders: undefined,
  };
  if (utf8ByteLength(JSON.stringify(withoutHeaders)) <= maxBytes) {
    return withoutHeaders;
  }

  const tiny = Math.min(512, inlineBodyBytes);
  return {
    ...withoutHeaders,
    requestBodyPreview: captureBodies
      ? truncatePreview(input.requestBodyPreview, tiny)
      : undefined,
    responseBodyPreview: captureBodies
      ? truncatePreview(input.responseBodyPreview, tiny)
      : undefined,
  };
}

export function buildNetworkEvent(
  partial: Omit<NetworkEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
  options?: SanitizeNetworkEventOptions
): NetworkEvent {
  return sanitizeNetworkEvent(
    {
      id: partial.id ?? newEventId(),
      timestamp: partial.timestamp ?? new Date().toISOString(),
      ...partial,
    },
    options
  );
}

/**
 * Builds dashboard `POST /api/network-events` URL from proxy/dashboard base URL.
 */
export function joinDashboardNetworkEventsUrl(dashboardBaseUrl: string): string {
  const normalizedBase = dashboardBaseUrl.trim().replace(/\/+$/, '');
  return `${normalizedBase}/api/network-events`;
}

/**
 * Best-effort POST of a network event to the dashboard.
 * Never throws; safe to call from interceptors. Callers may ignore the
 * returned promise (fire-and-forget) or await it when they need the POST
 * to finish before process exit.
 */
export function emitNetworkLogEvent(options: NetworkLogEmitterOptions): Promise<void> {
  const base = options.dashboardBaseUrl?.trim();
  if (!base) return Promise.resolve();

  const event = buildNetworkEvent(
    {
      ...options.event,
      id: options.event.id,
      timestamp: options.event.timestamp,
    },
    { captureBodies: options.captureBodies }
  );

  const url = joinDashboardNetworkEventsUrl(base);
  const body = JSON.stringify({ event });

  const post = async (): Promise<void> => {
    // Prefer unpatched fetch so POSTs never enter Mockifyer interceptors / proxy / recording.
    const fetchFn = resolveUnpatchedFetch();
    if (!fetchFn) return;
    try {
      await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
    } catch {
      // ignore — observability must not break app requests
    }
  };

  return post();
}

/**
 * Best-effort POST of a hop to Metro `/mockifyer-network-events` for the live CLI stream.
 * Never throws. Enabled via {@link resolveMetroNetworkStreamBaseUrl}.
 */
export function emitMetroNetworkStreamEvent(event: NetworkEvent): Promise<void> {
  const base = resolveMetroNetworkStreamBaseUrl();
  if (!base) return Promise.resolve();

  const fetchFn = resolveUnpatchedFetch();
  if (!fetchFn) return Promise.resolve();

  const url = joinMetroNetworkEventsUrl(base);
  const body = JSON.stringify({ event });

  return (async (): Promise<void> => {
    try {
      await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
    } catch {
      // ignore — Metro may be down; observability must not break app requests
    }
  })();
}

/** Stable hash prefix for correlating proxy rows (optional display). */
export function networkEventHashFromRequestKey(requestKey: string): string {
  return sha256Hex(requestKey).slice(0, 16);
}

/**
 * Resolves dashboard base URL for SDK network log POSTs.
 * Precedence: **`MOCKIFYER_DASHBOARD_URL`** → `networkLog.dashboardBaseUrl` → `proxy.baseUrl`.
 */
export function resolveNetworkLogDashboardUrl(
  config: Pick<MockifyerConfig, 'networkLog' | 'proxy'>
): string | undefined {
  if (config.networkLog?.enabled === false) return undefined;
  const fromEnv =
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_DASHBOARD_URL]?.trim() : undefined;
  if (fromEnv) return fromEnv;
  const fromConfig = config.networkLog?.dashboardBaseUrl?.trim();
  if (fromConfig) return fromConfig;
  const fromProxy = config.proxy?.baseUrl?.trim();
  if (fromProxy) return fromProxy;
  return undefined;
}

/**
 * Dashboard origin for crash forensics links — includes runtime URL from {@link configureAtlas}
 * when ErrorBoundary config omits proxy / dashboardBaseUrl.
 */
export function resolveForensicsDashboardBaseUrl(
  config?: Pick<MockifyerConfig, 'networkLog' | 'proxy' | 'atlas'>
): string | undefined {
  const fromConfig = resolveNetworkLogDashboardUrl(config ?? {});
  if (fromConfig) return fromConfig;
  const atlasUrl = config?.atlas?.dashboardBaseUrl?.trim();
  if (atlasUrl) return atlasUrl;
  return getAtlasUsageDashboardBaseUrl();
}

export function resolveNetworkLogCaptureBodies(config: Pick<MockifyerConfig, 'networkLog'>): boolean {
  return config.networkLog?.captureBodies === true;
}

export function resolveNetworkLogSpillBodies(config: Pick<MockifyerConfig, 'networkLog'>): boolean {
  if (config.networkLog?.spillBodies === false) return false;
  return resolveNetworkLogCaptureBodies(config);
}

export interface EmitMockifyerNetworkEventParams {
  config: Pick<MockifyerConfig, 'networkLog' | 'proxy'>;
  scenario?: string;
  clientId?: string;
  sessionId?: string;
  event: Omit<NetworkEvent, 'id' | 'timestamp' | 'scenario' | 'transport'> & {
    id?: string;
    transport?: NetworkEventTransport;
  };
  /** Raw request body for spill / preview (not kept in full on the hop). */
  requestBody?: unknown;
  /** Raw response body for shape / anomaly detection / spill. */
  responseBody?: unknown;
}

/** Read include-trace flags from Mockifyer config (RN / client outbound opt-in). */
export function resolveNetworkLogIncludeTraceOptions(
  config?: Pick<MockifyerConfig, 'networkLog'> | null
): { includeInlineTrace: boolean; includeInlineTraceBodies: boolean } {
  return {
    includeInlineTrace: config?.networkLog?.includeTraceHeader === true,
    includeInlineTraceBodies: config?.networkLog?.includeTraceBodies === true,
  };
}

/**
 * Run after the current response turn so body stringify does not delay the caller.
 * `setImmediate` is a macrotask (Node). Browsers and React Native use `setTimeout(0)`.
 */
function scheduleAfterResponse(task: () => void): void {
  const immediate = (globalThis as { setImmediate?: (fn: () => void) => void }).setImmediate;
  if (typeof immediate === 'function') {
    immediate(task);
    return;
  }
  setTimeout(task, 0);
}

/** Pretty-print only the short slice kept on the hop, not the full captured text. */
function previewFromCapturedText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const slice =
    utf8ByteLength(text) <= NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES
      ? text
      : truncateUtf8(text, NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES);
  return prettyPrintJsonText(slice);
}

const PREVIEW_TRUNCATION_MARKER = '…[truncated]';

interface CapturedNetworkBody {
  /** Compact text small enough to spill. Absent when the body exceeds the spill cap. */
  spillText?: string;
  /** Short hop preview when the body was too large to spill. */
  oversizedPreview?: string;
}

/** Prefix that stays within the inline preview budget, including the truncation marker. */
function inlinePreviewSlice(text: string): string {
  if (utf8ByteLength(text) <= NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES) return text;
  const markerBytes = utf8ByteLength(PREVIEW_TRUNCATION_MARKER);
  const budget = Math.max(0, NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES - markerBytes);
  const bytes = new TextEncoder().encode(text);
  const head = new TextDecoder().decode(bytes.slice(0, budget)).replace(/\uFFFD$/, '');
  return `${head}${PREVIEW_TRUNCATION_MARKER}`;
}

/**
 * One compact stringify. Bodies over the spill cap contribute a short preview only
 * and are not passed to the spill writer.
 */
function captureNetworkBody(value: unknown, existingPreview: unknown): CapturedNetworkBody {
  const text = serializeBodyText(value);
  if (text) {
    if (utf8ByteLength(text) <= NETWORK_BODY_SPILL_MAX_BYTES) {
      return { spillText: text };
    }
    return { oversizedPreview: inlinePreviewSlice(text) };
  }
  if (typeof existingPreview === 'string') {
    const fromPreview = serializeBodyForSpill(existingPreview);
    if (fromPreview) return { spillText: fromPreview };
  }
  return {};
}

/** Emit when Mockifyer config is available (fetch/axios interceptors). */
export function emitMockifyerNetworkEvent(params: EmitMockifyerNetworkEventParams): void {
  scheduleAfterResponse(() => {
    emitMockifyerNetworkEventNow(params);
  });
}

function emitMockifyerNetworkEventNow(params: EmitMockifyerNetworkEventParams): void {
  const recorderConfig = resolveFlightRecorderConfig(params.config);
  configureFlightRecorder(recorderConfig);

  const captureBodies = resolveNetworkLogCaptureBodies(params.config);
  const spillBodies = resolveNetworkLogSpillBodies(params.config);
  setNetworkBodySpillEnabled(spillBodies);
  const dashboardBaseUrl = resolveNetworkLogDashboardUrl(params.config);

  const responseShape =
    params.responseBody !== undefined ? responseShapeFingerprint(params.responseBody) : params.event.responseShape;

  const anomalyFlags =
    params.event.anomalyFlags ??
    detectResponseAnomalies({
      status: params.event.status,
      source: params.event.source,
      durationMs: params.event.durationMs,
      responseBody: params.responseBody,
    });

  const eventId = params.event.id?.trim() || newEventId();
  const requestCapture = captureBodies
    ? captureNetworkBody(params.requestBody, params.event.requestBodyPreview)
    : {};
  const responseCapture = captureBodies
    ? captureNetworkBody(params.responseBody, params.event.responseBodyPreview)
    : {};

  const spillRefs =
    spillBodies && captureBodies
      ? scheduleNetworkBodySpill({
          eventId,
          requestId: params.event.requestId,
          requestBodyText: requestCapture.spillText,
          responseBodyText: responseCapture.spillText,
        })
      : {};

  const built = buildNetworkEvent(
    {
      ...params.event,
      id: eventId,
      kind: params.event.kind ?? 'network',
      scenario: params.scenario ?? 'default',
      transport: params.event.transport ?? 'fetch',
      sessionId: params.event.sessionId ?? params.sessionId ?? null,
      clientId: params.event.clientId ?? params.clientId ?? null,
      responseShape,
      anomalyFlags: anomalyFlags.length > 0 ? anomalyFlags : undefined,
      usage: params.event.usage ?? resolveUsageForNetworkEmit(),
      requestBodyPreview:
        previewFromCapturedText(requestCapture.spillText ?? requestCapture.oversizedPreview) ??
        params.event.requestBodyPreview,
      responseBodyPreview:
        previewFromCapturedText(responseCapture.spillText ?? responseCapture.oversizedPreview) ??
        params.event.responseBodyPreview,
      requestBodyRef: spillRefs.requestBodyRef ?? params.event.requestBodyRef,
      responseBodyRef: spillRefs.responseBodyRef ?? params.event.responseBodyRef,
      requestBodyTruncated: spillRefs.requestBodyTruncated ?? params.event.requestBodyTruncated,
      responseBodyTruncated: spillRefs.responseBodyTruncated ?? params.event.responseBodyTruncated,
    },
    { captureBodies }
  );

  if (recorderConfig.enabled !== false) {
    recordFlightNetworkEvent(built);
  }

  if (getAtlasDocHtmlOutputPath()) {
    rememberAtlasHtmlNetworkEvent(built);
  }

  void emitMetroNetworkStreamEvent(built);

  if (!dashboardBaseUrl) return;

  emitNetworkLogEvent({
    dashboardBaseUrl,
    captureBodies,
    event: built,
  });
}
