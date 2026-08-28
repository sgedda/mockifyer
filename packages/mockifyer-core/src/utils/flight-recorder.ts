import type { MockifyerConfig } from '../types';
import type { NetworkEvent } from './network-event-types';

export interface FlightRecorderConfig {
  /** When false, the in-process buffer is disabled. Default: true. */
  enabled?: boolean;
  maxEvents?: number;
  maxIncidents?: number;
}

export interface FlightRecorderRuntimeContext {
  scenario?: string;
  clientId?: string;
  sessionId?: string;
}

const DEFAULT_MAX_EVENTS = 200;
const DEFAULT_MAX_INCIDENTS = 50;

let globalConfig: FlightRecorderConfig = { enabled: true, maxEvents: DEFAULT_MAX_EVENTS };
let runtimeContext: FlightRecorderRuntimeContext = {};

const networkBuffer: NetworkEvent[] = [];
const incidentBuffer: NetworkEvent[] = [];

export function configureFlightRecorder(config: FlightRecorderConfig): void {
  globalConfig = {
    enabled: config.enabled !== false,
    maxEvents: config.maxEvents ?? DEFAULT_MAX_EVENTS,
    maxIncidents: config.maxIncidents ?? DEFAULT_MAX_INCIDENTS,
  };
}

export function resolveFlightRecorderConfig(
  config: Pick<MockifyerConfig, 'networkLog'>
): FlightRecorderConfig {
  const fromConfig = config.networkLog?.flightRecorder;
  if (fromConfig?.enabled === false) {
    return { enabled: false };
  }
  return {
    enabled: fromConfig?.enabled ?? config.networkLog?.enabled !== false,
    maxEvents: fromConfig?.maxEvents ?? DEFAULT_MAX_EVENTS,
    maxIncidents: fromConfig?.maxIncidents ?? DEFAULT_MAX_INCIDENTS,
  };
}

export function setFlightRecorderRuntimeContext(ctx: FlightRecorderRuntimeContext): void {
  runtimeContext = { ...runtimeContext, ...ctx };
}

export function getFlightRecorderRuntimeContext(): FlightRecorderRuntimeContext {
  return { ...runtimeContext };
}

/** Screen / flow session from {@link setFlightRecorderRuntimeContext} wins over app-boot session. */
export function resolveActiveMockifyerSessionId(createBootSessionId: () => string): string {
  const fromContext = runtimeContext.sessionId?.trim();
  if (fromContext) {
    return fromContext;
  }
  return createBootSessionId();
}

function isRecorderEnabled(): boolean {
  return globalConfig.enabled !== false;
}

function pushToRing<T>(buf: T[], item: T, max: number): void {
  buf.unshift(item);
  if (buf.length > max) {
    buf.length = max;
  }
}

export function recordFlightNetworkEvent(event: NetworkEvent): NetworkEvent | null {
  if (!isRecorderEnabled()) return null;
  pushToRing(networkBuffer, event, globalConfig.maxEvents ?? DEFAULT_MAX_EVENTS);
  return event;
}

export function recordFlightIncidentEvent(event: NetworkEvent): NetworkEvent | null {
  if (!isRecorderEnabled()) return null;
  pushToRing(incidentBuffer, event, globalConfig.maxIncidents ?? DEFAULT_MAX_INCIDENTS);
  return event;
}

export interface RecentHopsOptions {
  sessionId?: string | null;
  clientId?: string | null;
  sinceMs?: number;
  beforeMs?: number;
  limit?: number;
}

export function getRecentFlightHops(options: RecentHopsOptions = {}): NetworkEvent[] {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), globalConfig.maxEvents ?? DEFAULT_MAX_EVENTS);
  const sinceMs = options.sinceMs;
  const beforeMs = options.beforeMs;
  const sessionId = options.sessionId?.trim() || undefined;
  const clientId = options.clientId?.trim() || undefined;

  const filtered = networkBuffer.filter((event) => {
    if (event.kind === 'incident') return false;
    if (sessionId && (event.sessionId ?? '') !== sessionId) return false;
    if (clientId && (event.clientId ?? '') !== clientId) return false;
    const ts = Date.parse(event.timestamp);
    if (Number.isFinite(sinceMs) && Number.isFinite(ts) && ts < sinceMs!) return false;
    if (Number.isFinite(beforeMs) && Number.isFinite(ts) && ts > beforeMs!) return false;
    return true;
  });

  return filtered.slice(0, limit);
}

export function getRecentFlightIncidents(options: RecentHopsOptions = {}): NetworkEvent[] {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), globalConfig.maxIncidents ?? DEFAULT_MAX_INCIDENTS);
  const sessionId = options.sessionId?.trim() || undefined;
  const clientId = options.clientId?.trim() || undefined;
  const beforeMs = options.beforeMs;

  const filtered = incidentBuffer.filter((event) => {
    if (sessionId && (event.sessionId ?? '') !== sessionId) return false;
    if (clientId && (event.clientId ?? '') !== clientId) return false;
    const ts = Date.parse(event.timestamp);
    if (Number.isFinite(beforeMs) && Number.isFinite(ts) && ts > beforeMs!) return false;
    return true;
  });

  return filtered.slice(0, limit);
}

export function clearFlightRecorder(): void {
  networkBuffer.length = 0;
  incidentBuffer.length = 0;
}

/** Test helper — not for production use. */
export function __flightRecorderBuffersForTests(): {
  network: NetworkEvent[];
  incidents: NetworkEvent[];
} {
  return { network: [...networkBuffer], incidents: [...incidentBuffer] };
}
