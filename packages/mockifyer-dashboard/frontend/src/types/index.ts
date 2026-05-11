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
  } | null
  sessionId: string | null
  hasResponseDateOverrides?: boolean
  responseDateOverridesPreview?: Array<{
    path: string
    summary: string
  }>
  /** When true, Mockifyer always calls the live API for this request (mock file is kept). */
  alwaysUseRealApi?: boolean
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
  }
  metadata: {
    size: number
    created: string
    modified: string
  }
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
}

