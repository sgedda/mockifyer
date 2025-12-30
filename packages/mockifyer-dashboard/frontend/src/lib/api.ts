import type { MockFile, MockData, Stats, ScenarioConfig } from '@/types'

const API_BASE = '/api'

export async function getMocks(scenario?: string): Promise<{ files: MockFile[]; mockDataPath: string; scenario: string }> {
  const url = scenario ? `${API_BASE}/mocks?scenario=${encodeURIComponent(scenario)}` : `${API_BASE}/mocks`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch mocks')
  return response.json()
}

export async function getMock(filename: string): Promise<MockData> {
  const response = await fetch(`${API_BASE}/mocks/${filename}`)
  if (!response.ok) throw new Error('Failed to fetch mock')
  return response.json()
}

export async function updateMock(filename: string, responseData: any): Promise<void> {
  const response = await fetch(`${API_BASE}/mocks/${filename}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responseData }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to update mock')
  }
}

export async function deleteMock(filename: string): Promise<void> {
  const response = await fetch(`${API_BASE}/mocks/${filename}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete mock')
}

export async function duplicateMock(filename: string): Promise<{ newFilename: string }> {
  const response = await fetch(`${API_BASE}/mocks/${filename}/duplicate`, {
    method: 'POST',
  })
  if (!response.ok) throw new Error('Failed to duplicate mock')
  return response.json()
}

export async function getStats(): Promise<Stats> {
  const response = await fetch(`${API_BASE}/stats`)
  if (!response.ok) throw new Error('Failed to fetch stats')
  return response.json()
}

export async function getScenarioConfig(): Promise<ScenarioConfig> {
  const response = await fetch(`${API_BASE}/scenario-config`)
  if (!response.ok) throw new Error('Failed to fetch scenario config')
  const data = await response.json()
  // Map the API response to match ScenarioConfig interface
  // API returns 'scenarios' but frontend expects 'availableScenarios'
  return {
    currentScenario: data.currentScenario,
    availableScenarios: data.scenarios || data.availableScenarios || []
  }
}

export async function setScenario(scenario: string): Promise<void> {
  const response = await fetch(`${API_BASE}/scenario-config/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to set scenario')
  }
}

export async function createScenario(scenario: string): Promise<ScenarioConfig> {
  const response = await fetch(`${API_BASE}/scenario-config/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create scenario')
  }
  const data = await response.json()
  // Map the API response to match ScenarioConfig interface
  return {
    currentScenario: data.currentScenario,
    availableScenarios: data.scenarios || []
  }
}

export interface DateConfig {
  dateManipulation: {
    fixedDate?: string | null
    offset?: number
    timezone?: string
  } | null
  currentDate: string
}

export async function getDateConfig(): Promise<DateConfig> {
  const response = await fetch(`${API_BASE}/date-config`)
  if (!response.ok) throw new Error('Failed to fetch date config')
  return response.json()
}

export async function updateDateConfig(config: {
  fixedDate?: string | null
  offset?: number | null
  timezone?: string | null
}): Promise<DateConfig> {
  const response = await fetch(`${API_BASE}/date-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update date config')
  }
  return response.json()
}

