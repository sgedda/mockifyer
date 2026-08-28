/** How the request was resolved (proxy / SDK). */
export type NetworkEventSource =
  | 'mock-hit'
  | 'mock-miss'
  | 'upstream'
  | 'blocked'
  | 'error';

export type NetworkEventTransport = 'axios' | 'fetch' | 'proxy' | 'app';

export type NetworkEventPhase = 'request_start' | 'request_end' | 'complete';

export type TimelineEventKind = 'network' | 'incident';

export type IncidentType =
  | 'error_boundary'
  | 'unhandledrejection'
  | 'uncaught_exception';

export type MockMatchMode = 'exact' | 'similar' | 'passthrough' | 'upstream';

/** Stored network log entry (dashboard ring buffer / SDK POST). */
export interface NetworkEvent {
  id: string;
  timestamp: string;
  scenario: string;
  kind?: TimelineEventKind;
  incidentType?: IncidentType;
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
  matchMode?: MockMatchMode;
  responseShape?: string;
  anomalyFlags?: string[];
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  errorMessage?: string;
  stackPreview?: string;
  componentStackPreview?: string;
}
