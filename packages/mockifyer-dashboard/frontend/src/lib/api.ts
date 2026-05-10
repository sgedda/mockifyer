import type { MockFile, MockData, MockResponseDateOverride, Stats, ScenarioConfig } from '@/types'

const API_BASE = '/api'

/** Prevent stale API responses (browser HTTP cache on GET). */
const noStore: RequestInit = { cache: 'no-store' }

function mapScenarioConfigPayload(data: Record<string, unknown>): ScenarioConfig {
  return {
    currentScenario: String(data.currentScenario ?? ''),
    availableScenarios: (Array.isArray(data.scenarios)
      ? data.scenarios
      : Array.isArray(data.availableScenarios)
        ? data.availableScenarios
        : []) as string[],
    scenarioLocks:
      data.scenarioLocks && typeof data.scenarioLocks === 'object' && data.scenarioLocks !== null
        ? (data.scenarioLocks as Record<string, boolean>)
        : {},
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const err = (await response.json()) as { error?: string; message?: string }
    if (typeof err.error === 'string' && err.error) return err.error
    if (typeof err.message === 'string' && err.message) return err.message
  } catch {
    // ignore
  }
  return fallback
}

export async function getMocks(scenario?: string): Promise<{ files: MockFile[]; mockDataPath: string; scenario: string }> {
  const url = scenario ? `${API_BASE}/mocks?scenario=${encodeURIComponent(scenario)}` : `${API_BASE}/mocks`
  const response = await fetch(url, noStore)
  if (!response.ok) throw new Error('Failed to fetch mocks')
  return response.json()
}

export async function searchMocks(params: {
  q: string
  scenario?: string
  limit?: number
}): Promise<{ files: MockFile[]; mockDataPath: string; scenario: string; query: string; truncated?: boolean }> {
  const q = params.q ?? ''
  const scenario = params.scenario
  const limit = params.limit
  const qs = new URLSearchParams()
  qs.set('q', q)
  if (scenario) qs.set('scenario', scenario)
  if (typeof limit === 'number' && Number.isFinite(limit)) qs.set('limit', String(limit))

  const response = await fetch(`${API_BASE}/mocks/search?${qs.toString()}`, noStore)
  if (!response.ok) throw new Error('Failed to search mocks')
  return response.json()
}

export async function getMock(filename: string, scenario?: string): Promise<MockData> {
  const q = scenario ? `?scenario=${encodeURIComponent(scenario)}` : ''
  const response = await fetch(`${API_BASE}/mocks/${filename}${q}`, noStore)
  if (!response.ok) throw new Error('Failed to fetch mock')
  return response.json()
}

export async function updateMock(
  filename: string,
  responseData: any,
  responseDateOverrides?: MockResponseDateOverride[] | null,
  alwaysUseRealApi?: boolean,
  scenario?: string
): Promise<void> {
  const body: Record<string, unknown> = { responseData }
  if (responseDateOverrides !== undefined) {
    body.responseDateOverrides = responseDateOverrides
  }
  if (alwaysUseRealApi !== undefined) {
    body.alwaysUseRealApi = alwaysUseRealApi
  }
  const q = scenario ? `?scenario=${encodeURIComponent(scenario)}` : ''
  const response = await fetch(`${API_BASE}/mocks/${filename}${q}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const message = await readErrorMessage(response, 'Failed to update mock')
    throw new Error(message)
  }
}

export async function deleteMock(filename: string, scenario?: string): Promise<void> {
  const q = scenario ? `?scenario=${encodeURIComponent(scenario)}` : ''
  const response = await fetch(`${API_BASE}/mocks/${filename}${q}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const message = await readErrorMessage(response, 'Failed to delete mock')
    throw new Error(message)
  }
}

export async function duplicateMock(filename: string, scenario?: string): Promise<{ newFilename: string }> {
  const q = scenario ? `?scenario=${encodeURIComponent(scenario)}` : ''
  const response = await fetch(`${API_BASE}/mocks/${filename}/duplicate${q}`, {
    method: 'POST',
  })
  if (!response.ok) {
    const message = await readErrorMessage(response, 'Failed to duplicate mock')
    throw new Error(message)
  }
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
  return mapScenarioConfigPayload(data)
}

export async function setScenarioLock(scenario: string, locked: boolean): Promise<ScenarioConfig> {
  const response = await fetch(`${API_BASE}/scenario-config/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, locked }),
  })
  if (!response.ok) {
    const message = await readErrorMessage(response, 'Failed to update scenario lock')
    throw new Error(message)
  }
  const data = await response.json()
  return mapScenarioConfigPayload(data)
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

export interface ClientLane {
  clientId: string
  scenario: string
  note: string | null
  devices?: {
    count: number
    recent: Array<{
      deviceId: string
      lastSeenAt: string
    }>
  }
}

export async function getClientLanes(): Promise<{
  enabled: boolean
  reason?: string | null
  lanes: ClientLane[]
  discoveredLanes?: string[]
  globalScenario: string | null
}> {
  const response = await fetch(`${API_BASE}/client-lanes`, noStore)
  if (!response.ok) throw new Error('Failed to fetch client lanes')
  return response.json()
}

export async function setClientLaneScenario(clientId: string, scenario: string | null): Promise<void> {
  const response = await fetch(`${API_BASE}/client-lanes/${encodeURIComponent(clientId)}/scenario`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || 'Failed to set lane scenario')
  }
}

export async function setClientLaneNote(clientId: string, note: string | null): Promise<void> {
  const response = await fetch(`${API_BASE}/client-lanes/${encodeURIComponent(clientId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || 'Failed to set lane note')
  }
}

export async function createScenario(scenario: string, deriveFrom?: string | null): Promise<ScenarioConfig> {
  const response = await fetch(`${API_BASE}/scenario-config/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, deriveFrom: deriveFrom ?? null }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create scenario')
  }
  const data = await response.json()
  return mapScenarioConfigPayload(data)
}

export interface ProxyConfig {
  scenario: string
  recordOnMiss: boolean
  allowUpstream: boolean
  updatedAt: string | null
}

export async function getProxyConfig(scenario: string): Promise<ProxyConfig> {
  const q = `?scenario=${encodeURIComponent(scenario)}`
  const response = await fetch(`${API_BASE}/proxy-config${q}`, noStore)
  if (!response.ok) throw new Error('Failed to fetch proxy config')
  return response.json()
}

export async function updateProxyConfig(payload: {
  scenario: string
  recordOnMiss: boolean
  allowUpstream: boolean
}): Promise<void> {
  const response = await fetch(`${API_BASE}/proxy-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || 'Failed to update proxy config')
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
  /** Effective source: Redis, per-scenario file, legacy root, or none */
  configSource?: 'scenario' | 'legacy' | 'none' | 'redis'
  /** Where the dashboard persists date settings */
  storage?: 'redis' | 'filesystem'
  /** Redis key when `storage === 'redis'` (read hits Redis first, then filesystem fallback) */
  redisKey?: string
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
    const message = await readErrorMessage(response, 'Failed to update date config')
    throw new Error(message)
  }
  return response.json()
}

