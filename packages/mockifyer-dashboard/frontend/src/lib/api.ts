import type {
  MockFile,
  MockData,
  MockResponseDateOverride,
  Stats,
  ScenarioConfig,
  ScenarioExportBundle,
} from '@/types'
import { getApiBase } from '@/lib/base-path'

const API_BASE = getApiBase()

/** Prevent stale API responses (browser HTTP cache on GET). */
const noStore: RequestInit = { cache: 'no-store' }

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
    const error = await response.json()
    throw new Error(error.error || error.message || 'Failed to update mock')
  }
}

export async function deleteMock(filename: string, scenario?: string): Promise<void> {
  const q = scenario ? `?scenario=${encodeURIComponent(scenario)}` : ''
  const response = await fetch(`${API_BASE}/mocks/${filename}${q}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete mock')
}

export async function duplicateMock(filename: string, scenario?: string): Promise<{ newFilename: string }> {
  const q = scenario ? `?scenario=${encodeURIComponent(scenario)}` : ''
  const response = await fetch(`${API_BASE}/mocks/${filename}/duplicate${q}`, {
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
  // Map the API response to match ScenarioConfig interface
  return {
    currentScenario: data.currentScenario,
    availableScenarios: data.scenarios || []
  }
}

export async function exportScenarioBundle(scenario?: string): Promise<ScenarioExportBundle> {
  const qs =
    scenario !== undefined && scenario !== ''
      ? `?scenario=${encodeURIComponent(scenario)}`
      : ''
  const response = await fetch(`${API_BASE}/scenario-config/export${qs}`, noStore)
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to export scenario')
  }
  return response.json()
}

export async function importScenarioBundle(payload: {
  bundle: ScenarioExportBundle
  targetScenario: string
  replaceExistingMocks?: boolean
  applyDateConfig?: boolean
  applyProxyConfig?: boolean
}): Promise<{
  success: boolean
  message: string
  targetScenario: string
  scenarios: string[]
  mocksWritten: number
  dateConfigApplied: boolean
  proxyConfigApplied: boolean
}> {
  const body = {
    ...payload.bundle,
    targetScenario: payload.targetScenario,
    replaceExistingMocks: payload.replaceExistingMocks ?? false,
    applyDateConfig: payload.applyDateConfig !== false,
    applyProxyConfig: payload.applyProxyConfig !== false,
  }
  const response = await fetch(`${API_BASE}/scenario-config/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      (err as { details?: string }).details ||
        (err as { error?: string }).error ||
        'Failed to import scenario'
    )
  }
  return response.json()
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
    const error = await response.json()
    throw new Error(error.error || 'Failed to update date config')
  }
  return response.json()
}

