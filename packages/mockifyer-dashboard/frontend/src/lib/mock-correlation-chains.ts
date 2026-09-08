import type { MockFile } from '@/types'
import { endpointToDomainPath } from '@/lib/domainTreeMatch'

export interface MockChainMaps {
  byRequestId: Map<string, MockFile>
  byFilename: Map<string, MockFile>
  childrenByParent: Map<string, MockFile[]>
}

export interface MockServiceChain {
  id: string
  hops: MockFile[]
  latestModified: string
  /** True when hops were ordered by time + URL heuristics (no requestId links on mocks). */
  inferred?: boolean
  /** Hops prepended by URL/time (or parent walk) — not part of the original id-linked subtree. */
  enrichedHopFilenames?: string[]
}

/** Unique sibling group for nested service-chain display (Atlas-style). */
export interface MockUniqueChainNode {
  fingerprint: string
  representative: MockFile
  hops: MockFile[]
  callCount: number
  children: MockUniqueChainNode[]
}

/** Typical multi-service demo hop order (lower = earlier in chain). */
const INFERRED_HOP_PATH_ORDER: Array<{ test: (url: string) => boolean }> = [
  { test: (u) => /\/aggregate\b/i.test(u) },
  { test: (u) => /\/via-axios\b/i.test(u) },
  { test: (u) => /\/product\b/i.test(u) },
  { test: (u) => /jsonplaceholder\.typicode\.com/i.test(u) },
  { test: (u) => /typicode\.com/i.test(u) },
]

const INFER_CLUSTER_MS = 15_000
/** Wider window when attaching entry hops (e.g. `/aggregate`) to an id-linked chain. */
const ENRICH_CHAIN_CLUSTER_MS = 120_000

/** Keep in sync with `packages/mockifyer-core/src/utils/hop-chain.ts`. */
const SESSION_FANOUT_MIN_HOPS = 16
const SESSION_FANOUT_MIN_UNIQUE_ENDPOINTS = 8
const SESSION_FANOUT_MIN_UNIQUE_HOSTS = 3
const SESSION_FANOUT_MAX_NESTING = 1
const DAISY_CHAIN_MIN_HOPS = 16

const UUID_IN_PATH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const NUMERIC_PATH_SEGMENT = /\/\d+(?=\/|$)/g

function parseEndpointParts(url: string | null | undefined): { host: string; path: string } {
  const raw = url?.trim() ?? ''
  if (!raw) return { host: '', path: '' }
  try {
    const parsed = new URL(raw)
    return { host: parsed.host, path: parsed.pathname || '/' }
  } catch {
    return { host: '', path: raw.split('?')[0] ?? raw }
  }
}

export function mockHopEndpointFingerprint(mock: MockFile): string {
  const method = (mock.method ?? 'GET').toUpperCase()
  const { path } = parseEndpointParts(mock.endpoint)
  const normalized = (path || '/').replace(UUID_IN_PATH, ':id').replace(NUMERIC_PATH_SEGMENT, '/:id')
  return `${method} ${normalized}`
}

function mockHopHostKey(mock: MockFile): string {
  const { host, path } = parseEndpointParts(mock.endpoint)
  return host ? host.toLowerCase() : path
}

function describeMockChainShape(hops: MockFile[]): {
  hopCount: number
  uniqueEndpoints: number
  uniqueHosts: number
  maxDepth: number
} {
  const uniqueEndpoints = new Set(hops.map(mockHopEndpointFingerprint))
  const uniqueHosts = new Set(hops.map(mockHopHostKey).filter(Boolean))
  const byFilename = new Map(hops.map((hop) => [hop.filename, hop]))
  const byRequestId = new Map<string, MockFile>()
  for (const hop of hops) {
    if (hop.requestId) byRequestId.set(hop.requestId, hop)
  }

  let maxDepth = 0
  for (const hop of hops) {
    let depth = 0
    let current: MockFile | undefined = hop
    const seen = new Set<string>()
    while (current?.parentRequestId) {
      if (seen.has(current.filename)) break
      seen.add(current.filename)
      const parent = byRequestId.get(current.parentRequestId)
      if (!parent || !byFilename.has(parent.filename)) break
      depth += 1
      current = parent
    }
    if (depth > maxDepth) maxDepth = depth
  }

  return {
    hopCount: hops.length,
    uniqueEndpoints: uniqueEndpoints.size,
    uniqueHosts: uniqueHosts.size,
    maxDepth,
  }
}

function isNonsensicalMockServiceChain(hops: MockFile[]): boolean {
  const shape = describeMockChainShape(hops)
  const sessionFanout =
    shape.hopCount >= SESSION_FANOUT_MIN_HOPS &&
    shape.uniqueEndpoints >= SESSION_FANOUT_MIN_UNIQUE_ENDPOINTS &&
    shape.maxDepth <= SESSION_FANOUT_MAX_NESTING &&
    shape.uniqueHosts >= SESSION_FANOUT_MIN_UNIQUE_HOSTS
  const daisyChain = shape.hopCount >= DAISY_CHAIN_MIN_HOPS && shape.maxDepth >= shape.hopCount - 1
  return sessionFanout || daisyChain
}

function inferHopSortKey(mock: MockFile): number {
  const url = mock.endpoint ?? ''
  for (let i = 0; i < INFERRED_HOP_PATH_ORDER.length; i++) {
    if (INFERRED_HOP_PATH_ORDER[i].test(url)) return i
  }
  return 100 + new Date(mock.modified).getTime() / 1e12
}

function clusterMocksByModifiedTime(mocks: MockFile[], windowMs: number): MockFile[][] {
  const sorted = [...mocks].sort(
    (a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime()
  )
  const groups: MockFile[][] = []
  for (const mock of sorted) {
    const t = new Date(mock.modified).getTime()
    const last = groups[groups.length - 1]
    if (last?.length) {
      const prev = new Date(last[last.length - 1].modified).getTime()
      if (Math.abs(t - prev) <= windowMs) {
        last.push(mock)
        continue
      }
    }
    groups.push([mock])
  }
  return groups
}

function clusterLooksLikeServiceChain(hops: MockFile[]): boolean {
  if (hops.length < 2) return false
  if (isNonsensicalMockServiceChain(hops)) return false
  const hosts = new Set<string>()
  let knownPatternHits = 0
  for (const hop of hops) {
    const url = hop.endpoint ?? ''
    if (!url) continue
    try {
      const u = new URL(url)
      hosts.add(u.port ? `${u.hostname}:${u.port}` : u.hostname)
    } catch {
      hosts.add(url)
    }
    if (INFERRED_HOP_PATH_ORDER.some((p) => p.test(url))) knownPatternHits += 1
  }
  return hosts.size >= 2 || (knownPatternHits >= 2 && hops.length >= 2)
}

function buildInferredMockServiceChains(mocks: MockFile[]): MockServiceChain[] {
  const chains: MockServiceChain[] = []
  const assigned = new Set<string>()

  for (const cluster of clusterMocksByModifiedTime(mocks, INFER_CLUSTER_MS)) {
    if (!clusterLooksLikeServiceChain(cluster)) continue
    const hops = [...cluster]
      .filter((m) => !assigned.has(m.filename))
      .sort((a, b) => inferHopSortKey(a) - inferHopSortKey(b))
    if (hops.length < 2) continue
    for (const hop of hops) assigned.add(hop.filename)
    const latestModified = hops.reduce(
      (max, hop) => (new Date(hop.modified) > new Date(max) ? hop.modified : max),
      hops[0].modified
    )
    chains.push({
      id: `inferred-${hops[0].filename}`,
      hops,
      latestModified,
      inferred: true,
    })
  }

  chains.sort((a, b) => new Date(b.latestModified).getTime() - new Date(a.latestModified).getTime())
  return chains
}

export function buildMockChainMaps(mocks: MockFile[]): MockChainMaps {
  const byRequestId = new Map<string, MockFile>()
  const byFilename = new Map<string, MockFile>()
  const childrenByParent = new Map<string, MockFile[]>()

  for (const mock of mocks) {
    byFilename.set(mock.filename, mock)
    if (mock.requestId) {
      byRequestId.set(mock.requestId, mock)
    }
    if (mock.parentRequestId) {
      const siblings = childrenByParent.get(mock.parentRequestId) ?? []
      siblings.push(mock)
      childrenByParent.set(mock.parentRequestId, siblings)
    }
  }

  return { byRequestId, byFilename, childrenByParent }
}

export function formatMockHopLabel(mock: MockFile): string {
  const method = (mock.method ?? 'GET').toUpperCase()
  if (mock.endpoint) {
    try {
      const url = new URL(mock.endpoint)
      return `${method} ${url.pathname || '/'}`
    } catch {
      return `${method} ${mock.endpoint}`
    }
  }
  return mock.filename.includes('/') ? mock.filename.split('/').pop()! : mock.filename
}

/** Short host + path line for chain step subtitles. */
export function formatMockHopSubtitle(mock: MockFile): string {
  if (!mock.endpoint) return mock.filename
  try {
    const url = new URL(mock.endpoint)
    const host = url.port ? `${url.hostname}:${url.port}` : url.hostname
    return `${host}${url.pathname}${url.search}`
  } catch {
    return mock.endpoint
  }
}

export function getMockChain(
  mock: MockFile,
  byRequestId: Map<string, MockFile>,
  childrenByParent?: Map<string, MockFile[]>
): MockFile[] {
  const chain: MockFile[] = [mock]
  const seen = new Set<string>([mock.filename])
  let current = mock

  while (current.parentRequestId) {
    const parent = byRequestId.get(current.parentRequestId)
    if (!parent || seen.has(parent.filename)) {
      break
    }
    if (childrenByParent && parent.requestId) {
      const siblingCount = childrenByParent.get(parent.requestId)?.length ?? 0
      if (siblingCount >= SESSION_FANOUT_MIN_HOPS) {
        break
      }
    }
    chain.unshift(parent)
    seen.add(parent.filename)
    current = parent
  }

  return chain
}

export function mockChainDepth(
  mock: MockFile,
  byRequestId: Map<string, MockFile>,
  childrenByParent?: Map<string, MockFile[]>
): number {
  return getMockChain(mock, byRequestId, childrenByParent).length - 1
}

export function isMockChainRoot(mock: MockFile, byRequestId: Map<string, MockFile>): boolean {
  if (!mock.parentRequestId) return true
  return !byRequestId.has(mock.parentRequestId)
}

export function mockHasChainChildren(mock: MockFile, childrenByParent: Map<string, MockFile[]>): boolean {
  if (!mock.requestId) return false
  return (childrenByParent.get(mock.requestId)?.length ?? 0) > 0
}

export function mockIsInServiceChain(
  mock: MockFile,
  maps: Pick<MockChainMaps, 'byRequestId' | 'childrenByParent'>
): boolean {
  if (!mock.requestId && !mock.parentRequestId) return false
  if (mock.parentRequestId) return true
  return mockHasChainChildren(mock, maps.childrenByParent)
}

function orderHopsFromRoot(root: MockFile, chainMocks: MockFile[], maps: MockChainMaps): MockFile[] {
  const inChain = new Set(chainMocks.map((m) => m.filename))
  const ordered: MockFile[] = [root]

  const visit = (parentRequestId: string) => {
    const children = (maps.childrenByParent.get(parentRequestId) ?? []).filter((c) => inChain.has(c.filename))
    children.sort(
      (a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime()
    )
    for (const child of children) {
      ordered.push(child)
      if (child.requestId) visit(child.requestId)
    }
  }

  if (root.requestId) visit(root.requestId)

  for (const m of chainMocks) {
    if (!ordered.some((o) => o.filename === m.filename)) {
      ordered.push(m)
    }
  }

  return ordered
}

function collectDescendants(
  root: MockFile,
  maps: MockChainMaps,
  chainMocks: MockFile[]
): void {
  if (!root.requestId) return
  const children = maps.childrenByParent.get(root.requestId) ?? []
  for (const child of children) {
    if (!chainMocks.some((m) => m.filename === child.filename)) {
      chainMocks.push(child)
      collectDescendants(child, maps, chainMocks)
    }
  }
}

/** Multi-hop service chains (root → downstream), newest chains first. */
export function buildMockServiceChains(mocks: MockFile[]): MockServiceChain[] {
  const maps = buildMockChainMaps(mocks)
  const assigned = new Set<string>()
  const chains: MockServiceChain[] = []

  for (const mock of mocks) {
    if (!mockIsInServiceChain(mock, maps)) continue
    if (!isMockChainRoot(mock, maps.byRequestId)) continue
    if (!mockHasChainChildren(mock, maps.childrenByParent)) continue
    if (assigned.has(mock.filename)) continue

    const chainMocks: MockFile[] = [mock]
    collectDescendants(mock, maps, chainMocks)

    const hops = orderHopsFromRoot(mock, chainMocks, maps)
    if (hops.length < 2) continue
    if (isNonsensicalMockServiceChain(hops)) continue

    for (const hop of hops) assigned.add(hop.filename)

    const latestModified = hops.reduce(
      (max, hop) => (new Date(hop.modified) > new Date(max) ? hop.modified : max),
      hops[0].modified
    )

    chains.push({
      id: mock.requestId ?? mock.filename,
      hops,
      latestModified,
    })
  }

  // Orphan hops: parent id points outside loaded mocks but child is in list
  for (const mock of mocks) {
    if (assigned.has(mock.filename)) continue
    if (!mock.parentRequestId) continue
    if (!maps.byRequestId.has(mock.parentRequestId)) {
      const chainMocks: MockFile[] = [mock]
      collectDescendants(mock, maps, chainMocks)
      if (chainMocks.length < 2) continue
      const hops = [...chainMocks].sort(
        (a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime()
      )
      if (isNonsensicalMockServiceChain(hops)) continue
      for (const hop of hops) assigned.add(hop.filename)
      chains.push({
        id: mock.requestId ?? mock.filename,
        hops,
        latestModified: hops[hops.length - 1].modified,
      })
    }
  }

  chains.sort((a, b) => new Date(b.latestModified).getTime() - new Date(a.latestModified).getTime())
  return chains
}

function walkUpAncestorsByRequestId(
  head: MockFile,
  maps: MockChainMaps,
  seen: Set<string>
): MockFile[] {
  const prefix: MockFile[] = []
  let current: MockFile | undefined = head
  while (current?.parentRequestId?.trim()) {
    const parent = maps.byRequestId.get(current.parentRequestId.trim())
    if (!parent || seen.has(parent.filename)) {
      break
    }
    prefix.unshift(parent)
    seen.add(parent.filename)
    current = parent
  }
  return prefix
}

/**
 * Prepends missing entry hops (e.g. gateway `/aggregate`) onto id-linked chains.
 */
export function enrichChainHopsForDisplay(
  hops: MockFile[],
  catalog: MockFile[],
  maps: MockChainMaps
): { hops: MockFile[]; enrichedHopFilenames: string[] } {
  if (hops.length === 0) {
    return { hops, enrichedHopFilenames: [] }
  }

  const seen = new Set(hops.map((h) => h.filename))
  const enrichedFilenames: string[] = []

  const ancestorPrefix = walkUpAncestorsByRequestId(hops[0], maps, seen)
  for (const hop of ancestorPrefix) {
    enrichedFilenames.push(hop.filename)
  }

  let result = [...ancestorPrefix, ...hops]

  const times = result.map((h) => new Date(h.modified).getTime())
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const windowMs = Math.max(ENRICH_CHAIN_CLUSTER_MS, maxT - minT + 30_000)
  const minSortKey = inferHopSortKey(result[0])

  const pathPrepend = catalog
    .filter((mock) => {
      if (seen.has(mock.filename)) return false
      if (inferHopSortKey(mock) >= minSortKey) return false
      const t = new Date(mock.modified).getTime()
      return t >= minT - windowMs && t <= maxT + 5_000
    })
    .sort((a, b) => inferHopSortKey(a) - inferHopSortKey(b))

  for (const hop of pathPrepend) {
    seen.add(hop.filename)
    enrichedFilenames.push(hop.filename)
  }

  result = [...pathPrepend, ...result]
  result.sort((a, b) => {
    const keyDiff = inferHopSortKey(a) - inferHopSortKey(b)
    if (keyDiff !== 0) return keyDiff
    return new Date(a.modified).getTime() - new Date(b.modified).getTime()
  })

  const deduped: MockFile[] = []
  const dedupeSeen = new Set<string>()
  for (const hop of result) {
    if (dedupeSeen.has(hop.filename)) continue
    dedupeSeen.add(hop.filename)
    deduped.push(hop)
  }

  return { hops: deduped, enrichedHopFilenames: enrichedFilenames }
}

/**
 * Correlation-linked chains when mocks have requestId/parentRequestId; otherwise infers from
 * recording time + URL order (same user run, multi-host).
 */
export function buildMockServiceChainsForDisplay(mocks: MockFile[]): MockServiceChain[] {
  const maps = buildMockChainMaps(mocks)
  const linked = buildMockServiceChains(mocks)

  if (linked.length > 0) {
    return linked.map((chain) => {
      const { hops, enrichedHopFilenames } = enrichChainHopsForDisplay(chain.hops, mocks, maps)
      const latestModified = hops.reduce(
        (max, hop) => (new Date(hop.modified) > new Date(max) ? hop.modified : max),
        hops[0].modified
      )
      return {
        ...chain,
        hops,
        latestModified,
        inferred: chain.inferred === true || enrichedHopFilenames.length > 0,
        enrichedHopFilenames,
      }
    })
  }

  return buildInferredMockServiceChains(mocks)
}

export function isEnrichedChainHop(chain: MockServiceChain, hop: MockFile): boolean {
  return chain.enrichedHopFilenames?.includes(hop.filename) === true
}

export type MockHopTrafficMode = 'live' | 'replay' | 'pending'

export function getMockHopTrafficMode(
  mock: Pick<MockFile, 'alwaysUseRealApi' | 'responsePending'>
): MockHopTrafficMode {
  if (mock.responsePending === true) return 'pending'
  if (mock.alwaysUseRealApi === true) return 'live'
  return 'replay'
}

/**
 * Domain paths that must use Live API before `targetMocks` can be reached on Replay.
 * Upstream hops on Replay return a stored body and do not call the next service.
 */
export function collectUpstreamDomainPathsForReplay(
  targetMocks: MockFile[],
  catalogMocks: MockFile[]
): string[] {
  const chainMaps = buildMockChainMaps(catalogMocks)
  const domains = new Set<string>()

  const addHop = (hop: MockFile) => {
    const path = endpointToDomainPath(hop.endpoint)
    if (path) domains.add(path)
  }

  for (const mock of targetMocks) {
    const linked = getMockChain(mock, chainMaps.byRequestId, chainMaps.childrenByParent)
    let idx = linked.findIndex((h) => h.filename === mock.filename)
    if (idx > 0) {
      for (let i = 0; i < idx; i++) addHop(linked[i])
    }

    for (const chain of buildMockServiceChainsForDisplay(catalogMocks)) {
      idx = chain.hops.findIndex((h) => h.filename === mock.filename)
      if (idx > 0) {
        for (let i = 0; i < idx; i++) addHop(chain.hops[i])
      }
    }

    const targetKey = inferHopSortKey(mock)
    const targetTime = new Date(mock.modified).getTime()
    for (const candidate of catalogMocks) {
      if (candidate.filename === mock.filename) continue
      if (inferHopSortKey(candidate) >= targetKey) continue
      if (Math.abs(new Date(candidate.modified).getTime() - targetTime) > INFER_CLUSTER_MS) continue
      addHop(candidate)
    }
  }

  return [...domains]
}

/** True when an upstream hop on Replay prevents later hops from running. */
export function chainHasUpstreamReplayBlock(chain: MockFile[], hopIndex: number): boolean {
  if (hopIndex <= 0) return false
  for (let i = 0; i < hopIndex; i++) {
    if (getMockHopTrafficMode(chain[i]) === 'replay') return true
  }
  return false
}

/** Compact id for UI (full value in `title`). */
export function formatShortCorrelationId(id: string | null | undefined): string | null {
  if (!id?.trim()) return null
  const trimmed = id.trim()
  if (trimmed.length <= 14) return trimmed
  return `${trimmed.slice(0, 10)}…`
}

/** Human label for which upstream hop triggered this one. */
export function describeHopParentLink(chain: MockFile[], hopIndex: number): string | null {
  const hop = chain[hopIndex]
  if (hopIndex <= 0 || !hop.parentRequestId?.trim()) return null

  const parentId = hop.parentRequestId.trim()
  const parentHopIndex = chain.findIndex(
    (candidate, index) => index < hopIndex && candidate.requestId === parentId
  )
  const shortParent = formatShortCorrelationId(parentId)
  if (parentHopIndex >= 0) {
    return `Parent: hop ${parentHopIndex + 1}${shortParent ? ` (${shortParent})` : ''}`
  }
  return shortParent ? `Parent request id: ${shortParent} (not in this chain)` : 'Parent request id linked'
}

export function chainHasRequestCorrelation(chain: MockFile[]): boolean {
  return chain.some((hop, index) => index > 0 && Boolean(hop.parentRequestId?.trim()))
}

export function getChainRootRequestId(chain: MockFile[]): string | null {
  return chain[0]?.requestId?.trim() ?? null
}

function groupSiblingsByFingerprint(children: MockFile[]): MockUniqueChainNode[] {
  const groups = new Map<string, MockFile[]>()
  const order: string[] = []
  for (const child of children) {
    const key = mockHopEndpointFingerprint(child)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(child)
  }
  return order.map((key) => {
    const grouped = groups.get(key)!
    grouped.sort((a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime())
    return {
      fingerprint: key,
      representative: grouped[0],
      hops: grouped,
      callCount: grouped.length,
      children: [],
    }
  })
}

function uniqueChildrenOf(
  parents: MockFile[],
  maps: MockChainMaps,
  inChain: Set<string>
): MockUniqueChainNode[] {
  const kids: MockFile[] = []
  const seen = new Set<string>()
  for (const parent of parents) {
    if (!parent.requestId) continue
    for (const child of maps.childrenByParent.get(parent.requestId) ?? []) {
      if (!inChain.has(child.filename) || seen.has(child.filename)) continue
      seen.add(child.filename)
      kids.push(child)
    }
  }
  kids.sort((a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime())
  const grouped = groupSiblingsByFingerprint(kids)
  for (const node of grouped) {
    node.children = uniqueChildrenOf(node.hops, maps, inChain)
  }
  return grouped
}

/**
 * Nested unique-endpoint forest for display. Repeated sibling calls collapse to ×N
 * (same idea as Atlas HTML unique chains) instead of a linear dump of every hop.
 */
export function buildUniqueMockChainForest(hops: MockFile[]): MockUniqueChainNode[] {
  if (hops.length === 0) return []
  const maps = buildMockChainMaps(hops)
  const inChain = new Set(hops.map((h) => h.filename))
  const hasParentLinks = hops.some((h) => Boolean(h.parentRequestId?.trim()))

  if (hasParentLinks) {
    const roots = hops.filter((h) => {
      if (!h.parentRequestId?.trim()) return true
      const parent = maps.byRequestId.get(h.parentRequestId.trim())
      return !parent || !inChain.has(parent.filename)
    })
    const grouped = groupSiblingsByFingerprint(roots)
    for (const node of grouped) {
      node.children = uniqueChildrenOf(node.hops, maps, inChain)
    }
    return grouped
  }

  const nodes: MockUniqueChainNode[] = []
  for (const hop of hops) {
    const key = mockHopEndpointFingerprint(hop)
    const last = nodes[nodes.length - 1]
    if (last && last.fingerprint === key) {
      last.hops.push(hop)
      last.callCount += 1
      continue
    }
    nodes.push({
      fingerprint: key,
      representative: hop,
      hops: [hop],
      callCount: 1,
      children: [],
    })
  }
  return nodes
}

function countUniqueChainNodes(nodes: MockUniqueChainNode[]): number {
  let n = 0
  for (const node of nodes) {
    n += 1
    n += countUniqueChainNodes(node.children)
  }
  return n
}

export function countUniqueMockChainHops(hops: MockFile[]): number {
  return countUniqueChainNodes(buildUniqueMockChainForest(hops))
}
