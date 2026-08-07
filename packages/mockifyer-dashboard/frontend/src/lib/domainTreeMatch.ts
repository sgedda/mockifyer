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

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NUMERIC_SEGMENT = /^\d+$/

/** Collapse numeric/UUID segments to `:id` (mirrors core discovery keys). */
function collapseDomainPathIdSegments(domainPath: string): string {
  const parts = domainPath.trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  if (parts.length === 0) return ''
  const [host, ...segments] = parts
  const collapsed = segments.map((seg) =>
    NUMERIC_SEGMENT.test(seg) || UUID_SEGMENT.test(seg) ? ':id' : seg
  )
  return [host, ...collapsed].join('/')
}

function domainPathMatchRank(domainPath: string): { segments: number; concrete: number } {
  const parts = domainPath.trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  let concrete = 0
  for (const part of parts) {
    if (part !== ':id') concrete += 1
  }
  return { segments: parts.length, concrete }
}

function isBetterDomainPathMatch(candidate: string, current: string | null): boolean {
  if (!current) return true
  const a = domainPathMatchRank(candidate)
  const b = domainPathMatchRank(current)
  if (a.segments !== b.segments) return a.segments > b.segments
  return a.concrete > b.concrete
}

function findLongestRuleForPath(
  requestPath: string,
  rules: DomainPathRulesMap
): { domainPath: string; rule: DomainPathRulesMap[string] } | null {
  const normalized = requestPath.trim().replace(/^\/+|\/+$/g, '')
  if (!normalized) return null

  let best: { domainPath: string; rule: DomainPathRulesMap[string] } | null = null
  for (const [domainPath, rule] of Object.entries(rules)) {
    if (!domainPath.trim() || !rule) continue
    const prefix = domainPath.trim().replace(/^\/+|\/+$/g, '')
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      if (!best || isBetterDomainPathMatch(prefix, best.domainPath)) {
        best = { domainPath: prefix, rule }
      }
    }
  }
  return best
}

/**
 * Effective domain-path rule for a folder key.
 * Considers both literal paths and `:id`-collapsed discovery keys; at the same
 * depth prefers concrete IDs so dashboard toggles win over discovery seeds.
 */
export function findEffectiveDomainPathRule(
  folderPath: string,
  rules: DomainPathRulesMap
): { domainPath: string; rule: DomainPathRulesMap[string] } | null {
  const normalized = folderPath.trim().replace(/^\/+|\/+$/g, '')
  if (!normalized) return null

  const collapsed = collapseDomainPathIdSegments(normalized)
  const exactMatch = findLongestRuleForPath(normalized, rules)
  const collapsedMatch =
    collapsed !== normalized ? findLongestRuleForPath(collapsed, rules) : null

  if (!exactMatch) return collapsedMatch
  if (!collapsedMatch) return exactMatch
  return isBetterDomainPathMatch(collapsedMatch.domainPath, exactMatch.domainPath)
    ? collapsedMatch
    : exactMatch
}
