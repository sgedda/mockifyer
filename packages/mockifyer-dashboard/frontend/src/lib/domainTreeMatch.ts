import type { MockFile } from '@/types'
import type { DomainPathRulesMap } from '@/lib/api'
import { mockHopHitsUpstream } from '@/lib/mock-correlation-chains'

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
    if (mockHopHitsUpstream(m)) {
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

/**
 * Longest matching prefix that defines `allowUpstream` (may differ from the record/autoMock rule).
 */
export function findEffectiveAllowUpstreamOverride(
  folderPath: string,
  rules: DomainPathRulesMap
): { domainPath: string; allowUpstream: boolean } | null {
  const normalized = folderPath.trim().replace(/^\/+|\/+$/g, '')
  if (!normalized) return null

  let best: { domainPath: string; allowUpstream: boolean; len: number } | null = null
  for (const [domainPath, rule] of Object.entries(rules)) {
    if (!domainPath.trim() || !rule || typeof rule.allowUpstream !== 'boolean') continue
    const prefix = domainPath.trim().replace(/^\/+|\/+$/g, '')
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best.len) {
        best = { domainPath: prefix, allowUpstream: rule.allowUpstream, len: prefix.length }
      }
    }
  }
  return best
    ? { domainPath: best.domainPath, allowUpstream: best.allowUpstream }
    : null
}

/** Host segment of a domain-tree path (`api.example.com/v1` → `api.example.com`). */
export function hostFromDomainPath(domainPath: string): string | null {
  const host = domainPath.trim().replace(/^\/+|\/+$/g, '').split('/')[0]
  return host && host.length > 0 ? host : null
}

/**
 * Unique hosts for the Domains toolbar: endpoints in the catalog plus host keys from path rules.
 */
export function listDomainHosts(mocks: MockFile[], pathRules: DomainPathRulesMap): string[] {
  const hosts = new Set<string>()
  for (const mock of mocks) {
    const path = endpointToDomainPath(mock.endpoint ?? null)
    const host = path ? hostFromDomainPath(path) : null
    if (host && host !== '(unknown-host)') {
      hosts.add(host)
    }
  }
  for (const domainPath of Object.keys(pathRules)) {
    const host = hostFromDomainPath(domainPath)
    if (host) {
      hosts.add(host)
    }
  }
  return Array.from(hosts).sort((a, b) => a.localeCompare(b))
}
