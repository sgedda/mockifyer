export interface MockFile {
  filename: string
  filePath: string
  size: number
  created: string
  modified: string
  endpoint: string | null
  graphqlInfo: {
    query: string
    variables: any
  } | null
  sessionId: string | null
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
    scenario?: string
    sessionId?: string
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

