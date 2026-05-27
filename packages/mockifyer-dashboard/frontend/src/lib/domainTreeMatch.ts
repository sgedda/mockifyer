import type { MockFile } from '@/types'
import type { DomainPathRulesMap } from '@/lib/api'

/** Domain tree path for a mock endpoint (`host` + pathname segments), e.g. `127.0.0.1:4102/product`. */
export function endpointToDomainPath(endpoint: string | null | undefined): string | null {
  if (!endpoint?.trim()) return null
  try {
    const u = new URL(endpoint)
    const segments = u.pathname.replace(/\/+/g, '/').replace(/^\/|\/$/g, '').split('/').filter(Boolean)
    return [u.host, ...segments].join('/')
  } catch {
    return null
  }
}

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

export interface DomainFolderCounts {
  total: number
  live: number
  pending: number
  mocked: number
  /** Mocks with a captured response body (not request-only / pending). */
  recorded: number
}

export function countMocksInDomainFolder(mocks: MockFile[], domainPath: string): DomainFolderCounts {
  const counts: DomainFolderCounts = { total: 0, live: 0, pending: 0, mocked: 0, recorded: 0 }
  for (const m of mocks) {
    if (!endpointMatchesDomainPath(m.endpoint ?? null, domainPath)) continue
    counts.total += 1
    if (m.responsePending === true) {
      counts.pending += 1
      counts.live += 1
      continue
    }
    counts.recorded += 1
    if (m.alwaysUseRealApi === true) {
      counts.live += 1
    } else {
      counts.mocked += 1
    }
  }
  return counts
}

export function countLiveApiInMocks(mocks: MockFile[], domainPath: string): {
  total: number
  live: number
  pending: number
} {
  const c = countMocksInDomainFolder(mocks, domainPath)
  return { total: c.total, live: c.live, pending: c.pending }
}

export function aggregateLiveApiState(counts: { total: number; live: number }): LiveApiAggregate {
  if (counts.total === 0) return 'empty'
  if (counts.live === 0) return 'all_mock'
  if (counts.live === counts.total) return 'all_live'
  return 'mixed'
}

export function findEffectiveDomainPathRule(
  folderPath: string,
  rules: DomainPathRulesMap
): { domainPath: string; rule: DomainPathRulesMap[string] } | null {
  const normalized = folderPath.trim().replace(/^\/+|\/+$/g, '')
  if (!normalized) return null

  let best: { domainPath: string; rule: DomainPathRulesMap[string]; len: number } | null = null
  for (const [domainPath, rule] of Object.entries(rules)) {
    if (!domainPath.trim() || !rule) continue
    const prefix = domainPath.trim().replace(/^\/+|\/+$/g, '')
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best.len) {
        best = { domainPath: prefix, rule, len: prefix.length }
      }
    }
  }
  return best ? { domainPath: best.domainPath, rule: best.rule } : null
}
