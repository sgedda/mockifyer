import * as crypto from 'crypto';
import { ENV_VARS, type MockifyerConfig } from '../types';

/** How the request was resolved (proxy / SDK). */
export type NetworkEventSource =
  | 'mock-hit'
  | 'mock-miss'
  | 'upstream'
  | 'blocked'
  | 'error';

export type NetworkEventTransport = 'axios' | 'fetch' | 'proxy';

export type NetworkEventPhase = 'request_start' | 'request_end' | 'complete';

/** Stored network log entry (dashboard ring buffer / SDK POST). */
export interface NetworkEvent {
  id: string;
  timestamp: string;
  scenario: string;
  clientId?: string | null;
  deviceId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  parentRequestId?: string | null;
  sequence?: number;
  phase?: NetworkEventPhase;
  transport: NetworkEventTransport;
  method: string;
  url: string;
  host?: string;
  path?: string;
  query?: string;
  status?: number;
  durationMs?: number;
  source: NetworkEventSource;
  requestHash?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  errorMessage?: string;
}

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

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function newEventId(): string {
  return crypto.randomUUID();
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
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return text;
  return `${buf.subarray(0, maxBytes).toString('utf8')}…[truncated]`;
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
    host: input.host ?? host,
    path: input.path ?? path,
    query: input.query ?? query,
    requestHeaders: redactHeaders(input.requestHeaders, options.extraRedactHeaders),
    responseHeaders: redactHeaders(input.responseHeaders, options.extraRedactHeaders),
    requestBodyPreview: captureBodies ? truncatePreview(input.requestBodyPreview, maxBytes) : undefined,
    responseBodyPreview: captureBodies ? truncatePreview(input.responseBodyPreview, maxBytes) : undefined,
  };

  const serialized = JSON.stringify(event);
  if (Buffer.byteLength(serialized, 'utf8') <= maxBytes) {
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
 * Best-effort, non-blocking POST of a network event to the dashboard.
 * Never throws; safe to call from interceptors.
 */
export function emitNetworkLogEvent(options: NetworkLogEmitterOptions): void {
  const base = options.dashboardBaseUrl?.trim();
  if (!base) return;

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

  void post();
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

export function resolveNetworkLogCaptureBodies(config: Pick<MockifyerConfig, 'networkLog'>): boolean {
  return config.networkLog?.captureBodies === true;
}

export interface EmitMockifyerNetworkEventParams {
  config: Pick<MockifyerConfig, 'networkLog' | 'proxy'>;
  scenario?: string;
  clientId?: string;
  event: Omit<NetworkEvent, 'id' | 'timestamp' | 'scenario' | 'transport'> & {
    transport?: NetworkEventTransport;
  };
}

/** Emit when Mockifyer config is available (fetch/axios interceptors). */
export function emitMockifyerNetworkEvent(params: EmitMockifyerNetworkEventParams): void {
  const dashboardBaseUrl = resolveNetworkLogDashboardUrl(params.config);
  if (!dashboardBaseUrl) return;
  emitNetworkLogEvent({
    dashboardBaseUrl,
    captureBodies: resolveNetworkLogCaptureBodies(params.config),
    event: {
      ...params.event,
      scenario: params.scenario ?? 'default',
      transport: params.event.transport ?? 'fetch',
    },
  });
}
