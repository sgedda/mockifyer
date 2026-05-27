import type {
  MockFile,
  MockData,
  MockAiContext,
  AiContextMode,
  MockResponseDateOverride,
  Stats,
  ScenarioConfig,
  ScenarioExportBundle,
  SimilarBodyGroupSummary,
  NetworkEventsResponse,
  NetworkLogConfig,
  NetworkEvent,
  MockReplayMode,
} from '@/types'
import { getApiBase } from '@/lib/base-path'

const API_BASE = getApiBase()

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

export async function getMocks(
  scenario?: string,
  opts?: { similarGroups?: boolean; similarThreshold?: number }
): Promise<{
  files: MockFile[]
  mockDataPath: string
  scenario: string
  similarBodyGroups?: SimilarBodyGroupSummary[]
}> {
  const qs = new URLSearchParams()
  if (scenario) qs.set('scenario', scenario)
  if (opts?.similarGroups) {
    qs.set('similarGroups', '1')
    if (typeof opts.similarThreshold === 'number' && Number.isFinite(opts.similarThreshold)) {
      qs.set('similarThreshold', String(opts.similarThreshold))
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const response = await fetch(`${API_BASE}/mocks${suffix}`, noStore)
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

export async function getMockAiContext(
  filename: string,
  opts?: {
    scenario?: string
    mode?: AiContextMode
    includePaths?: string[]
    excludePaths?: string[]
    maxPaths?: number
    includeRelated?: boolean
  }
): Promise<MockAiContext> {
  const qs = new URLSearchParams()
  if (opts?.scenario) qs.set('scenario', opts.scenario)
  if (opts?.mode) qs.set('mode', opts.mode)
  if (opts?.includePaths?.length) qs.set('includePaths', opts.includePaths.join(','))
  if (opts?.excludePaths?.length) qs.set('excludePaths', opts.excludePaths.join(','))
  if (typeof opts?.maxPaths === 'number' && Number.isFinite(opts.maxPaths)) {
    qs.set('maxPaths', String(opts.maxPaths))
  }
  if (opts?.includeRelated === false) qs.set('includeRelated', '0')

  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const response = await fetch(`${API_BASE}/mocks/${filename}/ai-context${suffix}`, noStore)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || error.details || 'Failed to fetch AI context')
  }
  return response.json()
}

export async function updateMock(
  filename: string,
  responseData: any,
  responseDateOverrides?: MockResponseDateOverride[] | null,
  replayMode?: MockReplayMode | null,
  scenario?: string
): Promise<void> {
  const body: Record<string, unknown> = { responseData }
  if (responseDateOverrides !== undefined) {
    body.responseDateOverrides = responseDateOverrides
  }
  if (replayMode !== undefined) {
    body.replayMode = replayMode
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

export async function refreshMockFromLive(
  filename: string,
  scenario?: string,
  clientId?: string
): Promise<MockData> {
  const q = scenario ? `?scenario=${encodeURIComponent(scenario)}` : ''
  const response = await fetch(`${API_BASE}/mocks/${filename}/refresh-from-live${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientId ? { clientId } : {}),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || 'Failed to refresh mock from live API')
  }
  const payload = await response.json()
  return payload.data as MockData
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

export interface ClientLaneLastSeenResolved {
  scenario: string
  lastSeenAt: string
  resolutionSource: 'body_override' | 'lane_redis' | 'global_redis' | 'filesystem_fallback'
  clientBodyScenarioOverride: boolean
}

export interface ClientLane {
  clientId: string
  scenario: string
  note: string | null
  lastSeenResolved?: ClientLaneLastSeenResolved | null
  devices?: {
    count: number
    recent: Array<{
      deviceId: string
      lastSeenAt: string
      lastSeenResolved?: ClientLaneLastSeenResolved | null
    }>
  }
}

export type ClientConnectionStatus = 'connected' | 'mapped_idle' | 'unmapped'

export interface ClientConnectionRow {
  clientId: string
  configuredScenario: string | null
  lastResolvedScenario: string | null
  lastSeenAt: string | null
  lastResolvedAt: string | null
  deviceCount: number
  note: string | null
  status: ClientConnectionStatus
}

export async function getClientLanes(): Promise<{
  enabled: boolean
  reason?: string | null
  lanes: ClientLane[]
  discoveredLanes?: string[]
  connections?: ClientConnectionRow[]
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

export interface NetworkTraceHop {
  index: number
  eventId: string
  requestId: string | null
  parentRequestId: string | null
  method: string
  url: string
  status?: number
  source: string
  request?: { headers?: Record<string, string>; body?: string }
  response?: { status?: number; headers?: Record<string, string>; body?: string }
}

export interface NetworkTraceResponse {
  provider: string
  trace: {
    lookup: { by: string; value: string }
    rootRequestId: string | null
    hopCount: number
    hops: NetworkTraceHop[]
    incomplete: boolean
  }
}

export async function getNetworkEventTrace(params: {
  scenario: string
  requestId?: string
  eventId?: string
  clientId?: string
}): Promise<NetworkTraceResponse> {
  const qs = new URLSearchParams()
  qs.set('scenario', params.scenario)
  if (params.requestId) qs.set('requestId', params.requestId)
  if (params.eventId) qs.set('eventId', params.eventId)
  if (params.clientId) qs.set('clientId', params.clientId)
  const response = await fetch(`${API_BASE}/network-events/trace?${qs.toString()}`, noStore)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error((error as { error?: string }).error || 'Failed to fetch network trace')
  }
  return response.json()
}

export async function getNetworkEvents(params: {
  scenario: string
  clientId?: string
  limit?: number
  since?: string
}): Promise<NetworkEventsResponse> {
  const qs = new URLSearchParams()
  qs.set('scenario', params.scenario)
  if (params.clientId) qs.set('clientId', params.clientId)
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.since) qs.set('since', params.since)
  const response = await fetch(`${API_BASE}/network-events?${qs.toString()}`, noStore)
  if (!response.ok) throw new Error('Failed to fetch network events')
  return response.json()
}

export async function clearNetworkEvents(scenario: string, clientId?: string): Promise<void> {
  const qs = new URLSearchParams({ scenario })
  if (clientId) qs.set('clientId', clientId)
  const response = await fetch(`${API_BASE}/network-events?${qs.toString()}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to clear network events')
}

export async function getNetworkLogConfig(scenario: string): Promise<NetworkLogConfig & { scenario: string }> {
  const q = `?scenario=${encodeURIComponent(scenario)}`
  const response = await fetch(`${API_BASE}/network-events/config${q}`, noStore)
  if (!response.ok) throw new Error('Failed to fetch network log config')
  return response.json()
}

export async function updateNetworkLogConfig(
  scenario: string,
  patch: Partial<Pick<NetworkLogConfig, 'enabled' | 'captureBodies'>>
): Promise<NetworkLogConfig & { scenario: string }> {
  const response = await fetch(`${API_BASE}/network-events/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, ...patch }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error((error as { error?: string }).error || 'Failed to update network log config')
  }
  return response.json()
}

export async function bulkSetLiveApiForDomain(payload: {
  scenario: string
  domainPath: string
  useLiveApi: boolean
}): Promise<{
  ok: boolean
  updated: number
  skippedPending: number
  domainPath: string
}> {
  const response = await fetch(`${API_BASE}/mocks/bulk-live-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to update domain live API setting')
  }
  return response.json()
}

export async function bulkCaptureResponsesForDomain(payload: {
  scenario: string
  domainPath: string
  clientId?: string
}): Promise<{
  ok: boolean
  captured: number
  skippedAlready: number
  failed: number
  errors: Array<{ endpoint: string | null; message: string }>
  domainPath: string
}> {
  const response = await fetch(`${API_BASE}/mocks/bulk-capture-responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to bulk capture responses')
  }
  return response.json()
}

export interface DomainPathRule {
  recordResponses: boolean
  autoMock?: boolean
  updatedAt?: string
}

export type DomainPathRulesMap = Record<string, DomainPathRule>

export async function fetchDomainPathRules(scenario: string): Promise<DomainPathRulesMap> {
  const params = new URLSearchParams({ scenario })
  const response = await fetch(`${API_BASE}/mocks/domain-path-rules?${params}`)
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load domain path rules')
  }
  const data = (await response.json()) as { rules?: DomainPathRulesMap }
  return data.rules ?? {}
}

export async function setDomainPathRule(payload: {
  scenario: string
  domainPath: string
  rule: { recordResponses: boolean; autoMock?: boolean } | null
}): Promise<DomainPathRulesMap> {
  const response = await fetch(`${API_BASE}/mocks/domain-path-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to update domain path rule')
  }
  const data = (await response.json()) as { rules?: DomainPathRulesMap }
  return data.rules ?? {}
}

export async function appendNetworkEvent(
  scenario: string,
  event: Omit<NetworkEvent, 'id' | 'timestamp' | 'scenario'>
): Promise<void> {
  const response = await fetch(`${API_BASE}/network-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, event }),
  })
  if (!response.ok) throw new Error('Failed to append network event')
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

