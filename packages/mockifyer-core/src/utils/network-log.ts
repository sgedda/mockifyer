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

/** Remove URL credentials and mask common secret query params before storing network events. */
export function sanitizeUrlString(url: string): string {
  if (!url.trim()) return url;

  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
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
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
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
    requestBodyPreview: captureBodies ? truncatePreview(input.requestBodyPreview, maxBytes) : undefined,
    responseBodyPreview: captureBodies ? truncatePreview(input.responseBodyPreview, maxBytes) : undefined,
  };

  const serialized = JSON.stringify(event);
  if (utf8ByteLength(serialized) <= maxBytes) {
    return event;
  }

  return {
    ...event,
    requestBodyPreview: undefined,
    responseBodyPreview: undefined,
    requestHeaders: undefined,
    responseHeaders: undefined,
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
    if (typeof fetch !== 'function') return;
    try {
      await fetch(url, {
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

export interface EmitMockifyerNetworkEventParams {
  config: Pick<MockifyerConfig, 'networkLog' | 'proxy'>;
  scenario?: string;
  clientId?: string;
  sessionId?: string;
  event: Omit<NetworkEvent, 'id' | 'timestamp' | 'scenario' | 'transport'> & {
    transport?: NetworkEventTransport;
  };
  /** Raw response body for shape / anomaly detection (not persisted unless captureBodies). */
  responseBody?: unknown;
}

/** Emit when Mockifyer config is available (fetch/axios interceptors). */
export function emitMockifyerNetworkEvent(params: EmitMockifyerNetworkEventParams): void {
  const recorderConfig = resolveFlightRecorderConfig(params.config);
  configureFlightRecorder(recorderConfig);

  const captureBodies = resolveNetworkLogCaptureBodies(params.config);
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

  const built = buildNetworkEvent(
    {
      ...params.event,
      kind: params.event.kind ?? 'network',
      scenario: params.scenario ?? 'default',
      transport: params.event.transport ?? 'fetch',
      sessionId: params.event.sessionId ?? params.sessionId ?? null,
      clientId: params.event.clientId ?? params.clientId ?? null,
      responseShape,
      anomalyFlags: anomalyFlags.length > 0 ? anomalyFlags : undefined,
      usage: params.event.usage ?? resolveUsageForNetworkEmit(),
    },
    { captureBodies }
  );

  if (recorderConfig.enabled !== false) {
    recordFlightNetworkEvent(built);
  }

  if (getAtlasDocHtmlOutputPath()) {
    rememberAtlasHtmlNetworkEvent(built);
  }

  if (!dashboardBaseUrl) return;

  emitNetworkLogEvent({
    dashboardBaseUrl,
    captureBodies,
    event: built,
  });
}
