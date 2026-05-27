/** Paths are relative to `response.data` (see Mockifyer core). */
export interface MockResponseDateOverride {
  path: string
  base?: 'now' | 'response'
  offsetMs?: number
  offsetDays?: number
  offsetHours?: number
  offsetMinutes?: number
  format?: 'iso' | 'unix-ms' | 'unix-s'
}

export interface SimilarBodyGroupSummary {
  id: string
  operationName: string | null
  minSimilarity: number
  filenames: string[]
  size: number
}

/** How Mockifyer serves this recording on the next request. */
export type MockReplayMode = 'stored' | 'refresh-next' | 'always-refresh' | 'passthrough'

export interface MockFile {
  filename: string
  filePath: string
  size: number
  created: string
  modified: string
  endpoint: string | null
  /** HTTP method when available (GET/POST/...). */
  method?: string | null
  graphqlInfo: {
    query: string
    variables: any
    operationName?: string | null
  } | null
  sessionId: string | null
  hasResponseDateOverrides?: boolean
  responseDateOverridesPreview?: Array<{
    path: string
    summary: string
  }>
  /** When true, Mockifyer always calls the live API for this request (mock file is kept). */
  alwaysUseRealApi?: boolean
  replayMode?: MockReplayMode
  refreshOnNextRequest?: boolean
  alwaysRefreshFromLive?: boolean
  /** Request registered without a captured response yet. */
  responsePending?: boolean
  /** Hop id from `X-Mockifyer-Request-Id` when recorded with correlation. */
  requestId?: string | null
  /** Parent hop id from `X-Mockifyer-Parent-Request-Id` (upstream caller). */
  parentRequestId?: string | null
  /**
   * Present when GET /mocks was called with similarGroups=1 and this file is in a near-duplicate cluster
   * (same GraphQL op + variables + URL; high token overlap with other members).
   */
  similarBodyGroup?: { id: string; size: number; minSimilarity: number } | null
}

export interface MockData {
  filename: string
  data: {
    request: {
      url: string
      method: string
      headers?: Record<string, string>
      queryParams?: Record<string, any>
      data?: any
    }
    response: {
      status: number
      data: any
      headers?: Record<string, string>
    }
    timestamp?: string
    duration?: number // Request duration in milliseconds
    /** Alternate duration field from some recordings */
    responseTime?: number
    scenario?: string
    sessionId?: string
    requestId?: string
    parentRequestId?: string
    sequence?: number
    source?: string
    callStack?: string[]
    /** When serving the mock, rewrite these paths relative to the dashboard-configured “current” date. */
    responseDateOverrides?: MockResponseDateOverride[]
    /** When true, Mockifyer skips this recording and uses the real API (replay mode). */
    alwaysUseRealApi?: boolean
    refreshOnNextRequest?: boolean
    alwaysRefreshFromLive?: boolean
  }
  metadata: {
    size: number
    created: string
    modified: string
  }
}

export type AiContextMode = 'profile' | 'schema' | 'suggest' | 'full'

export interface AiFieldSchemaInfo {
  type: string
  enum?: unknown[]
  nullable?: boolean
}

export interface AiStateHint {
  path: string
  observed: unknown[]
}

export interface ScoredAiPath {
  path: string
  score: number
  reasons: string[]
  sampleValue?: unknown
}

export interface AiContextDiscoveryMeta {
  sources: string[]
  includedPaths: number
  omittedPaths: number
  omittedBytes: number
  mode: AiContextMode
}

export interface AiContextProfile {
  fields: Record<string, unknown>
  schema: Record<string, AiFieldSchemaInfo>
  stateHints: AiStateHint[]
}

export interface MockAiContext {
  filename: string
  scenario: string
  endpoint: { method: string; url: string; pathname: string }
  status: number
  mode: AiContextMode
  profile: AiContextProfile
  discovery: AiContextDiscoveryMeta
  suggestions?: ScoredAiPath[]
  data?: MockData['data']
}

export interface Stats {
  totalFiles: number
  totalSize: number
  endpoints: Array<{ endpoint: string; count: number }>
  domains: Record<string, number>
  methods: Record<string, number>
  statusCodes: Record<string, number>
  recentActivity: Array<{ filename: string; modified: string }>
  /** Files per subdirectory (matches mock folder layout under the scenario). */
  folderBreakdown?: Array<{ folder: string; count: number }>
  scenario: string
  mockDataPath?: string
  scenarioPath?: string
}

export interface ScenarioConfig {
  currentScenario: string
  availableScenarios: string[]
  /** When true, mock/date edits for that scenario are blocked server-side. */
  scenarioLocks?: Record<string, boolean>
}

/** Scenario backup JSON (`formatVersion` 1) from Settings export or GET /api/scenario-config/export */
export interface ScenarioBundleMockEntry {
  relativePath: string
  data: Record<string, unknown>
}

export interface ScenarioExportBundle {
  formatVersion: 1
  exportedAt: string
  sourceScenario: string
  dashboardProvider: 'filesystem' | 'sqlite' | 'redis'
  mocks: ScenarioBundleMockEntry[]
  dateManipulation: Record<string, unknown> | null
  proxyConfig: {
    recordOnMiss: boolean
    allowUpstream: boolean
  } | null
}

export type NetworkEventSource =
  | 'mock-hit'
  | 'mock-miss'
  | 'upstream'
  | 'blocked'
  | 'error'

export type NetworkEventTransport = 'axios' | 'fetch' | 'proxy'

export interface NetworkEvent {
  id: string
  timestamp: string
  scenario: string
  clientId?: string | null
  deviceId?: string | null
  sessionId?: string | null
  requestId?: string | null
  parentRequestId?: string | null
  sequence?: number
  phase?: 'request_start' | 'request_end' | 'complete'
  transport: NetworkEventTransport
  method: string
  url: string
  host?: string
  path?: string
  query?: string
  status?: number
  durationMs?: number
  source: NetworkEventSource
  requestHash?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBodyPreview?: string
  responseBodyPreview?: string
  errorMessage?: string
}

export interface NetworkLogConfig {
  enabled: boolean
  captureBodies: boolean
  updatedAt: string
}

export interface NetworkEventsResponse {
  scenario: string
  provider: string
  ephemeral: boolean
  networkLogConfig: NetworkLogConfig
  events: NetworkEvent[]
}

