/**
 * Dashboard location helpers. Nested path segments break the portable Vite `base: './'`
 * asset URLs on refresh, so resource identity lives in the query string on one-segment
 * routes (`/mocks`, `/mock`, `/network`, …). Those URLs copy/paste and reload cleanly.
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

export function mockEditorPath(filename: string, extras?: QueryUpdates): string {
  return `/mock${buildSearch({ ...extras, file: filename })}`
}

export function networkPath(extras?: QueryUpdates): string {
  return `/network${buildSearch(extras ?? {})}`
}

export function atlasPath(extras?: QueryUpdates): string {
  return `/atlas${buildSearch(extras ?? {})}`
}

export function fixturePoolPath(extras?: QueryUpdates): string {
  return `/fixture-pool${buildSearch(extras ?? {})}`
}

export function timelinePath(extras?: QueryUpdates): string {
  return `/timeline${buildSearch(extras ?? {})}`
}

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
