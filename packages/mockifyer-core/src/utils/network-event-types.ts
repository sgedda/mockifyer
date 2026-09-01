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

/**
 * How the app used a network hop — annotations on the trace spine.
 */
export interface NetworkEventUsage {
  /** Screen / flow name, e.g. `contact`. */
  screen?: string;
  /** Component or feature name, e.g. `PhoneDetails`. */
  component?: string;
  /** Human label for the UI. */
  label?: string;
  /** Optional CMS enrichment when the hop feeds a CMS node. */
  cms?: {
    pageId?: string;
    nodeId?: string;
    type?: string;
    path?: string;
  };
  /** Optional logical datasource name (app-defined). */
  datasourceId?: string;
  /** Optional slice within a shared response. */
  dataRoot?: string;
}

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
  /**
   * How the app used this hop (screen / component / optional CMS).
   * Single object when stamped at emit; array when multiple usages merged.
   */
  usage?: NetworkEventUsage | NetworkEventUsage[];
}
