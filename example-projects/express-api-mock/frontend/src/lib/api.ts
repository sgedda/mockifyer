// API client functions

export interface MockFile {
  filename: string
  filePath: string
  size: number
  created: Date
  modified: Date
  endpoint: string | null
  graphqlInfo: {
    query: string
    variables: any
  } | null
}

export interface MockFileListResponse {
  files: MockFile[]
  mockDataPath: string
}

export interface MockFileData {
  filename: string
  data: any
  metadata: {
    size: number
    created: Date
    modified: Date
  }
}

export interface DateConfig {
  fixedDate: string | null
  offset: number | null
  offsetDays: number | null
  offsetHours: number | null
  offsetMinutes: number | null
  offsetSign: '+' | '-' | null
  timezone: string | null
  enabled: boolean
  currentDate: string
  currentDateFormatted: string
}

// Mock files API
export async function getMockFiles(): Promise<MockFileListResponse> {
  const response = await fetch('/api/mocks')
  if (!response.ok) {
    throw new Error('Failed to fetch mock files')
  }
  return response.json()
}

export async function getMockFile(filename: string): Promise<MockFileData> {
  const response = await fetch(`/api/mocks/${filename}`)
  if (!response.ok) {
    throw new Error('Failed to fetch mock file')
  }
  return response.json()
}

export async function getMockFileContent(filename: string): Promise<any> {
  const response = await fetch(`/api/mocks/${filename}`)
  if (!response.ok) {
    throw new Error('Failed to fetch mock file content')
  }
  return response.json()
}

export async function updateMockFile(filename: string, responseData: any): Promise<void> {
  const response = await fetch(`/api/mocks/${filename}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ responseData }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update mock file')
  }
}

export async function deleteMockFile(filename: string): Promise<void> {
  const response = await fetch(`/api/mocks/${filename}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete mock file')
  }
}

// Date config API
export async function getDateConfig(): Promise<DateConfig> {
  const response = await fetch('/api/date-config')
  if (!response.ok) {
    throw new Error('Failed to fetch date config')
  }
  return response.json()
}

export async function updateDateConfig(config: Partial<DateConfig>): Promise<DateConfig> {
  const response = await fetch('/api/date-config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update date config')
  }
  const result = await response.json()
  return result.config
}

// Events API
export async function getFilteredEvents(filter?: 'upcoming' | 'past' | 'today') {
  const url = filter ? `/api/events/filtered?filter=${filter}` : '/api/events/filtered'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch events')
  }
  return response.json()
}

