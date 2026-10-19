/**
 * Dashboard location helpers. Nested path segments break the portable Vite `base: './'`
 * asset URLs on refresh, so resource identity lives in the query string on one-segment
 * routes (`/mocks`, `/mock`, `/hops`, `/network`, …). Those URLs copy/paste and reload cleanly.
 */

export const DASHBOARD_Q = {
  scenario: 'scenario',
  file: 'file',
  q: 'q',
  endpoint: 'endpoint',
  group: 'group',
  chains: 'chains',
  eventId: 'eventId',
  requestId: 'requestId',
  incidentId: 'incidentId',
  view: 'view',
  method: 'method',
  source: 'source',
  clientId: 'clientId',
  tab: 'tab',
  page: 'page',
  node: 'node',
  hop: 'hop',
  domain: 'domain',
  traffic: 'traffic',
  session: 'session',
  screen: 'screen',
  entity: 'entity',
  response: 'response',
} as const

export type QueryUpdates = Record<string, string | null | undefined>

export function buildSearch(params: QueryUpdates): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      qs.set(key, value)
    }
  }
  const serialized = qs.toString()
  return serialized ? `?${serialized}` : ''
}

export function patchSearchParams(
  current: URLSearchParams,
  updates: QueryUpdates
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }
  return next
}

export function searchParamsToRecord(params: URLSearchParams): Record<string, string> {
  const record: Record<string, string> = {}
  params.forEach((value, key) => {
    record[key] = value
  })
  return record
}

export function mocksListPath(extras?: QueryUpdates): string {
  return `/mocks${buildSearch(extras ?? {})}`
}

export function hopsPath(extras?: QueryUpdates): string {
  return `/hops${buildSearch(extras ?? {})}`
}

/** Open Hops focused on one recording (chain is highlighted, not filtered away). */
export function hopsFocusPath(params: { scenario?: string; filename: string }): string {
  return hopsPath({
    scenario: params.scenario,
    [DASHBOARD_Q.hop]: params.filename,
  })
}

export function mockEditorPath(filename: string, extras?: QueryUpdates): string {
  return `/mock${buildSearch({ ...extras, file: filename })}`
}

export function overridesPath(filename?: string, extras?: QueryUpdates): string {
  return `/overrides${buildSearch({ ...extras, file: filename })}`
}

export function networkPath(extras?: QueryUpdates): string {
  return `/network${buildSearch(extras ?? {})}`
}

/** Future Atlas page — not in nav. */
export function atlasPath(extras?: QueryUpdates): string {
  return `/atlas${buildSearch(extras ?? {})}`
}

/** Future Fixture pool page — not in nav. */
export function fixturePoolPath(extras?: QueryUpdates): string {
  return `/fixture-pool${buildSearch(extras ?? {})}`
}

/** Settings Client lanes card (`#client-lanes`). */
export const CLIENT_LANES_SECTION_ID = 'client-lanes'

export function pickPreservedQuery(
  params: URLSearchParams,
  keys: readonly string[]
): QueryUpdates {
  const extras: QueryUpdates = {}
  for (const key of keys) {
    const value = params.get(key)
    if (value) extras[key] = value
  }
  return extras
}

export type ScenarioUrlSyncPlan =
  | { action: 'none' }
  | { action: 'stamp-url'; scenario: string }
  | { action: 'apply-url'; urlScenario: string }

/**
 * Decide how the dashboard should sync `?scenario=` with React/server state.
 *
 * Must not run until GET /api/scenario-config has populated the real active
 * scenario. Booting with placeholder `default` and stamping that onto the URL
 * makes the later mismatch look like the user chose `default`, so
 * POST /api/scenario-config/set would clobber `_scratch` / named scenarios.
 */
/**
 * Query string for sidebar and tab navigation.
 *
 * Before scenario-config loads, `scenario` is the boot placeholder (`default`).
 * Writing that into the URL makes the later sync treat it as an explicit choice
 * and POST it over the real active scenario. Keep an existing `?scenario=` and
 * otherwise omit the param until config is ready.
 */
export function scenarioQueryForNavigation(input: {
  scenarioConfigReady: boolean
  scenario: string
  urlScenario: string | null
}): string {
  if (!input.scenarioConfigReady) {
    return input.urlScenario ? buildSearch({ scenario: input.urlScenario }) : ''
  }
  return buildSearch({ scenario: input.scenario })
}

export function planScenarioUrlSync(input: {
  scenarioConfigReady: boolean
  urlScenario: string | null
  scenario: string
  switchingScenario: boolean
  rejectedUrlScenario: string | null
}): ScenarioUrlSyncPlan {
  if (!input.scenarioConfigReady || input.switchingScenario) {
    return { action: 'none' }
  }
  if (!input.urlScenario) {
    return { action: 'stamp-url', scenario: input.scenario }
  }
  if (input.urlScenario === input.scenario) {
    return { action: 'none' }
  }
  if (input.rejectedUrlScenario === input.urlScenario) {
    return { action: 'none' }
  }
  return { action: 'apply-url', urlScenario: input.urlScenario }
}
