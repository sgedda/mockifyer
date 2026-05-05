import type { MockFile, MockData, MockResponseDateOverride, Stats, ScenarioConfig } from '@/types'

const API_BASE = '/api'

/** Prevent stale API responses (browser HTTP cache on GET). */
const noStore: RequestInit = { cache: 'no-store' }

function withScenario(url: string, scenario?: string): string {
  if (!scenario) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}scenario=${encodeURIComponent(scenario)}`
}

export async function getMocks(scenario?: string): Promise<{ files: MockFile[]; mockDataPath: string; scenario: string }> {
  const url = withScenario(`${API_BASE}/mocks`, scenario)
  const response = await fetch(url, noStore)
  if (!response.ok) throw new Error('Failed to fetch mocks')
  return response.json()
}

export async function getMock(filename: string, scenario?: string): Promise<MockData> {
  const response = await fetch(withScenario(`${API_BASE}/mocks/${filename}`, scenario), noStore)
  if (!response.ok) throw new Error('Failed to fetch mock')
  return response.json()
}

export async function updateMock(
  filename: string,
  responseData: any,
  responseDateOverrides?: MockResponseDateOverride[] | null,
  scenario?: string
): Promise<void> {
  const body: Record<string, unknown> = { responseData }
  if (responseDateOverrides !== undefined) {
    body.responseDateOverrides = responseDateOverrides
  }
  const response = await fetch(withScenario(`${API_BASE}/mocks/${filename}`, scenario), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || 'Failed to update mock')
  }
}

export async function deleteMock(filename: string, scenario?: string): Promise<void> {
  const response = await fetch(withScenario(`${API_BASE}/mocks/${filename}`, scenario), {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete mock')
}

export async function duplicateMock(filename: string, scenario?: string): Promise<{ newFilename: string }> {
  const response = await fetch(withScenario(`${API_BASE}/mocks/${filename}/duplicate`, scenario), {
    method: 'POST',
  })
  if (!response.ok) throw new Error('Failed to duplicate mock')
  return response.json()
}

export async function getStats(scenario?: string): Promise<Stats> {
  const url = scenario
    ? `${API_BASE}/stats?scenario=${encodeURIComponent(scenario)}`
    : `${API_BASE}/stats`
  const response = await fetch(url, noStore)
  if (!response.ok) throw new Error('Failed to fetch stats')
  return response.json()
}

export async function getScenarioConfig(): Promise<ScenarioConfig> {
  const response = await fetch(`${API_BASE}/scenario-config`, noStore)
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
  /** Scenario whose date-config.json is loaded or written */
  scenario?: string
  /** Active scenario from scenario-config.json (runtime) */
  currentScenario?: string
  /** Whether values came from per-scenario file or legacy root date-config.json */
  configSource?: 'scenario' | 'legacy' | 'none'
}

export async function getDateConfig(scenario?: string): Promise<DateConfig> {
  const q =
    scenario !== undefined && scenario !== ''
      ? `?scenario=${encodeURIComponent(scenario)}`
      : ''
  const response = await fetch(`${API_BASE}/date-config${q}`, noStore)
  if (!response.ok) throw new Error('Failed to fetch date config')
  return response.json()
}

export async function updateDateConfig(config: {
  fixedDate?: string | null
  offset?: number | null
  timezone?: string | null
  scenario?: string | null
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

