import type { MockFile } from '@/types'

export function endpointMatchesDomainPath(endpoint: string | null | undefined, domainPath: string): boolean {
  if (!endpoint || !domainPath.trim()) return false
  const prefix = domainPath.trim().replace(/^\/+|\/+$/g, '')
  try {
    const u = new URL(endpoint)
    const segments = u.pathname.replace(/\/+/g, '/').replace(/^\/|\/$/g, '').split('/').filter(Boolean)
    const full = [u.host, ...segments].join('/')
    return full === prefix || full.startsWith(`${prefix}/`)
  } catch {
    return false
  }
}

export type LiveApiAggregate = 'all_live' | 'all_mock' | 'mixed' | 'empty'

export function countLiveApiInMocks(mocks: MockFile[], domainPath: string): {
  total: number
  live: number
  pending: number
} {
  const counts = { total: 0, live: 0, pending: 0 }
  for (const m of mocks) {
    if (!endpointMatchesDomainPath(m.endpoint ?? null, domainPath)) continue
    counts.total += 1
    if (m.responsePending === true) counts.pending += 1
    if (m.alwaysUseRealApi === true || m.responsePending === true) counts.live += 1
  }
  return counts
}

export function aggregateLiveApiState(counts: { total: number; live: number }): LiveApiAggregate {
  if (counts.total === 0) return 'empty'
  if (counts.live === 0) return 'all_mock'
  if (counts.live === counts.total) return 'all_live'
  return 'mixed'
}
