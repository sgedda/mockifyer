import type { MockFile } from '@/types'
import { endpointMatchesDomainPath, endpointToDomainPath } from '@/lib/domainTreeMatch'

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
/** Wider window when attaching known gateway hops (e.g. `/aggregate`) to an id-linked chain. */
const ENRICH_CHAIN_CLUSTER_MS = 120_000
/** Sort key for URLs that are not in {@link INFERRED_HOP_PATH_ORDER}. */
const UNKNOWN_HOP_SORT_KEY = 100
/** Gateway `/aggregate`-style prepends only — never a whole client session. */
const MAX_ENRICHED_CATALOG_HOPS = 3
/** Real missing parents are a short gateway prefix, not a 70-hop walk. */
const MAX_ENRICHED_ANCESTORS = 4

/** Keep in sync with `packages/mockifyer-core/src/utils/hop-chain.ts`. */
const SESSION_FANOUT_MIN_HOPS = 16
const SESSION_FANOUT_MIN_UNIQUE_ENDPOINTS = 8
/** 2 covers dashboard-proxy recordings where most APIs share one host. */
const SESSION_FANOUT_MIN_UNIQUE_HOSTS = 2
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

/** GraphQL / BFF entry hop that routinely fans out to many upstream services. */
function isGraphqlLikeHop(mock: MockFile): boolean {
  if (mock.graphqlInfo) return true
  const method = (mock.method ?? 'GET').toUpperCase()
  if (method !== 'POST') return false
  const { path } = parseEndpointParts(mock.endpoint)
  return /\/graphql\/?$/i.test(path)
}

/** Public alias for bulk replay: GraphQL gateway hops vs source/leaf hops. */
export function isGraphqlBffHop(mock: MockFile): boolean {
  return isGraphqlLikeHop(mock)
}

/**
 * Real GraphQL BFFs call many distinct upstream hosts at depth 1 (bookings, tokens, CRM).
 * That looks like a client-session fan-out unless we exempt multi-host GraphQL roots.
 * Proxy dumps that mostly stay on the GraphQL host (≤2 external hosts) still drop.
 */
function isGraphqlBffFanout(hops: MockFile[]): boolean {
  const root = hops[0]
  if (!root || !isGraphqlLikeHop(root)) return false
  const rootHost = mockHopHostKey(root)
  const externalHosts = new Set(
    hops
      .slice(1)
      .map((hop) => mockHopHostKey(hop))
      .filter((host) => Boolean(host) && host !== rootHost)
  )
  return externalHosts.size >= 3
}

function isNonsensicalMockServiceChain(hops: MockFile[]): boolean {
  const shape = describeMockChainShape(hops)
  const sessionFanout =
    shape.hopCount >= SESSION_FANOUT_MIN_HOPS &&
    shape.uniqueEndpoints >= SESSION_FANOUT_MIN_UNIQUE_ENDPOINTS &&
    shape.maxDepth <= SESSION_FANOUT_MAX_NESTING &&
    shape.uniqueHosts >= SESSION_FANOUT_MIN_UNIQUE_HOSTS
  const daisyChain = shape.hopCount >= DAISY_CHAIN_MIN_HOPS && shape.maxDepth >= shape.hopCount - 1
  if (sessionFanout && isGraphqlBffFanout(hops)) {
    return daisyChain
  }
  return sessionFanout || daisyChain
}

function inferHopSortKey(mock: MockFile): number {
  const url = mock.endpoint ?? ''
  for (let i = 0; i < INFERRED_HOP_PATH_ORDER.length; i++) {
    if (INFERRED_HOP_PATH_ORDER[i].test(url)) return i
  }
  return UNKNOWN_HOP_SORT_KEY
}

function isKnownInferredEntryHop(mock: MockFile): boolean {
  return inferHopSortKey(mock) < UNKNOWN_HOP_SORT_KEY
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

export function endpointHostname(endpoint?: string | null): string {
  if (!endpoint?.trim()) return ''
  try {
    return new URL(endpoint).hostname
  } catch {
    return ''
  }
}

function endpointHostLabel(endpoint?: string | null): string {
  if (!endpoint?.trim()) return ''
  try {
    return new URL(endpoint).host
  } catch {
    return endpointHostname(endpoint)
  }
}

const OPAQUE_MOCK_FILENAME = /^[a-f0-9]{32,}\.json$/i

/** Redis catalog ids and other content-hash filenames — not useful as a hop label. */
export function isOpaqueMockFilename(filename: string | null | undefined): boolean {
  if (!filename?.trim()) return false
  const base = filename.includes('/') ? filename.split('/').pop() ?? filename : filename
  return OPAQUE_MOCK_FILENAME.test(base)
}

function usableHopEndpoint(endpoint?: string | null): string | undefined {
  const raw = endpoint?.trim()
  if (!raw || isOpaqueMockFilename(raw)) return undefined
  return raw
}

export interface HopPathLabelSource {
  method?: string | null
  endpoint?: string | null
  operationName?: string | null
  filename?: string | null
}

export type HopPathLabelKind = 'operation' | 'path' | 'host' | 'filename' | 'method'

export interface HopPathLabelParts {
  method: string
  kind: HopPathLabelKind
  text: string
  query?: string
}

export function hopPathLabelSourceFromMock(mock: Pick<MockFile, 'method' | 'endpoint' | 'filename' | 'graphqlInfo'>): HopPathLabelSource {
  return {
    method: mock.method,
    endpoint: mock.endpoint,
    operationName: mock.graphqlInfo?.operationName,
    filename: mock.filename,
  }
}

/** Stats catalog sometimes stores a hash as `endpoint`; prefer the compact mock list URL. */
export function hopPathLabelSourceWithCatalog(
  item: HopPathLabelSource,
  catalog?: Pick<MockFile, 'method' | 'endpoint' | 'filename' | 'graphqlInfo'> | null
): HopPathLabelSource {
  return {
    method: item.method || catalog?.method,
    endpoint: usableHopEndpoint(item.endpoint) ?? catalog?.endpoint,
    operationName: item.operationName || catalog?.graphqlInfo?.operationName,
    filename: item.filename || catalog?.filename,
  }
}

export function hopPathLabelParts(params: HopPathLabelSource): HopPathLabelParts {
  const method = (params.method ?? 'GET').toUpperCase()
  const operation = params.operationName?.trim()
  if (operation) return { method, kind: 'operation', text: operation }
  const endpoint = usableHopEndpoint(params.endpoint)
  if (endpoint) {
    try {
      const url = new URL(endpoint)
      const path = url.pathname || '/'
      const search = url.search
      if (path === '/' && !search) {
        if (url.hostname) return { method, kind: 'host', text: `${url.hostname}/` }
        return { method, kind: 'path', text: '/' }
      }
      return {
        method,
        kind: 'path',
        text: path,
        ...(search ? { query: search } : {}),
      }
    } catch {
      return { method, kind: 'path', text: endpoint }
    }
  }
  const filename = params.filename
  if (filename && !isOpaqueMockFilename(filename)) {
    const base = filename.includes('/') ? filename.split('/').pop()! : filename
    return { method, kind: 'filename', text: base }
  }
  return { method, kind: 'method', text: '' }
}

export function formatHopPathLabel(params: HopPathLabelSource): string {
  const parts = hopPathLabelParts(params)
  if (parts.kind === 'filename') return parts.text
  if (!parts.text) return parts.method
  return `${parts.method} ${parts.text}${parts.query ?? ''}`
}

export function formatHopPathLabelWithCatalog(
  item: HopPathLabelSource,
  catalog?: Pick<MockFile, 'method' | 'endpoint' | 'filename' | 'graphqlInfo'> | null
): string {
  return formatHopPathLabel(hopPathLabelSourceWithCatalog(item, catalog))
}

export function formatMockHopLabel(mock: MockFile): string {
  return formatHopPathLabel(hopPathLabelSourceFromMock(mock))
}

export function chainFirstLastHops(chain: MockServiceChain): { start: MockFile; end?: MockFile } | null {
  if (chain.hops.length === 0) return null
  const start = chain.hops[0]
  if (!start) return null
  if (chain.hops.length === 1) return { start }
  const startLabel = formatMockHopLabel(start)
  let end = chain.hops[chain.hops.length - 1]
  if (end && formatMockHopLabel(end) === startLabel) {
    for (let i = chain.hops.length - 2; i > 0; i -= 1) {
      const hop = chain.hops[i]
      if (hop && formatMockHopLabel(hop) !== startLabel) {
        end = hop
        break
      }
    }
  }
  if (!end || formatMockHopLabel(end) === startLabel) return { start }
  return { start, end }
}

/** Entry → leaf path so collapsed Statistics rows stay unique. */
export function formatChainFirstLastLabel(chain: MockServiceChain): string {
  const pair = chainFirstLastHops(chain)
  if (!pair) return chain.id
  const start = formatMockHopLabel(pair.start)
  if (!pair.end) return start
  return `${start} → ${formatMockHopLabel(pair.end)}`
}

export interface ChainLeafIndex {
  leaves: Set<string>
  inAChain: Set<string>
}

function collectForestLeafFilenames(nodes: MockUniqueChainNode[], out: Set<string>): void {
  for (const node of nodes) {
    if (node.children.length === 0) {
      for (const hop of node.hops) out.add(hop.filename)
      continue
    }
    collectForestLeafFilenames(node.children, out)
  }
}

/** Lowest-level hop files in each chain (parents with nested calls are excluded). */
export function indexChainLeafFilenames(chains: MockServiceChain[]): ChainLeafIndex {
  const leaves = new Set<string>()
  const inAChain = new Set<string>()
  for (const chain of chains) {
    for (const hop of chain.hops) inAChain.add(hop.filename)
    if (chain.hops.length === 1) {
      const only = chain.hops[0]
      if (only) leaves.add(only.filename)
      continue
    }
    collectForestLeafFilenames(buildUniqueMockChainForest(chain.hops), leaves)
  }
  return { leaves, inAChain }
}

export function isChainLeafHop(filename: string, index: ChainLeafIndex): boolean {
  if (index.leaves.has(filename)) return true
  return !index.inAChain.has(filename)
}

export interface MockChainRoleFilenames {
  /** GraphQL / BFF hops. */
  bff: string[]
  /** Lowest-level source hops (not GraphQL). */
  sources: string[]
  /** Parent hops that must be Live before source hops can be reached. */
  ancestorsOfSources: string[]
}

function collectRolesFromForest(
  nodes: MockUniqueChainNode[],
  bff: Set<string>,
  sources: Set<string>,
  ancestorsOfSources: Set<string>,
  ancestorFilenames: string[]
): void {
  for (const node of nodes) {
    const nodeFilenames = node.hops.map((hop) => hop.filename)
    for (const hop of node.hops) {
      if (isGraphqlLikeHop(hop)) bff.add(hop.filename)
    }
    if (node.children.length === 0) {
      const hasSourceLeaf = node.hops.some((hop) => !isGraphqlLikeHop(hop))
      for (const hop of node.hops) {
        if (!isGraphqlLikeHop(hop)) sources.add(hop.filename)
      }
      if (hasSourceLeaf) {
        for (const filename of ancestorFilenames) ancestorsOfSources.add(filename)
      }
      continue
    }
    collectRolesFromForest(node.children, bff, sources, ancestorsOfSources, [
      ...ancestorFilenames,
      ...nodeFilenames,
    ])
  }
}

/**
 * Split chain hops into GraphQL/BFF vs source/leaf filenames for bulk "use mock".
 */
export function collectMockChainRoleFilenames(chains: MockServiceChain[]): MockChainRoleFilenames {
  const bff = new Set<string>()
  const sources = new Set<string>()
  const ancestorsOfSources = new Set<string>()
  for (const chain of chains) {
    for (const hop of chain.hops) {
      if (isGraphqlLikeHop(hop)) bff.add(hop.filename)
    }
    collectRolesFromForest(
      buildUniqueMockChainForest(chain.hops),
      bff,
      sources,
      ancestorsOfSources,
      []
    )
  }
  for (const filename of bff) {
    sources.delete(filename)
  }
  return {
    bff: [...bff],
    sources: [...sources],
    ancestorsOfSources: [...ancestorsOfSources],
  }
}

export type ChainRoleReplayTarget = 'sources' | 'bff'

/**
 * Filenames to put on stored mock vs Live API for a bulk role replay.
 * Source replay also flips ancestor/BFF hops to Live so traffic can reach them.
 */
export function planChainRoleReplay(
  chains: MockServiceChain[],
  target: ChainRoleReplayTarget
): { stored: string[]; passthrough: string[] } {
  const roles = collectMockChainRoleFilenames(chains)
  if (target === 'bff') {
    return { stored: roles.bff, passthrough: [] }
  }
  const sourceSet = new Set(roles.sources)
  return {
    stored: roles.sources,
    passthrough: roles.ancestorsOfSources.filter((filename) => !sourceSet.has(filename)),
  }
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

/** True when this hop shares a missing parent id with at least one other mock. */
function sharesMissingParentWithSiblings(
  mock: MockFile,
  mocks: MockFile[],
  byRequestId: Map<string, MockFile>
): boolean {
  const parentId = mock.parentRequestId?.trim()
  if (!parentId || byRequestId.has(parentId)) return false
  return mocks.some(
    (other) => other.filename !== mock.filename && other.parentRequestId?.trim() === parentId
  )
}

/**
 * When always-refresh rewrote a GraphQL requestId, children still point at the old id.
 * Pick the nearest GraphQL hop that started just before (or near) the orphan window.
 */
function findGraphqlHealParentForOrphans(
  orphans: MockFile[],
  catalog: MockFile[],
  assigned: Set<string>
): MockFile | undefined {
  if (orphans.length === 0) return undefined
  const times = orphans
    .map((hop) => new Date(hop.modified).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
  if (times.length === 0) return undefined
  const windowStart = times[0]
  const windowEnd = times[times.length - 1]

  let best: MockFile | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (const candidate of catalog) {
    if (assigned.has(candidate.filename)) continue
    if (!isGraphqlLikeHop(candidate) || !candidate.requestId?.trim()) continue
    const t = new Date(candidate.modified).getTime()
    if (!Number.isFinite(t)) continue
    if (t < windowStart - ENRICH_CHAIN_CLUSTER_MS) continue
    if (t > windowEnd + ENRICH_CHAIN_CLUSTER_MS) continue
    // Prefer callers that started before the first orphan (GraphQL then myaccount/bookings).
    const score = t <= windowStart ? windowStart - t : (t - windowStart) * 4
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

/** Display-only clones so forest nesting uses the healed GraphQL requestId as parent. */
function adoptOrphansUnderGraphqlParent(parent: MockFile, orphans: MockFile[]): MockFile[] {
  const parentId = parent.requestId?.trim()
  if (!parentId) return orphans
  return orphans.map((orphan) =>
    orphan.parentRequestId?.trim() === parentId
      ? orphan
      : { ...orphan, parentRequestId: parentId }
  )
}

function orderHopsWithAdoptedChildren(
  root: MockFile,
  adoptedChildren: MockFile[],
  maps: MockChainMaps
): MockFile[] {
  const chainMocks: MockFile[] = [root, ...adoptedChildren]
  for (const hop of adoptedChildren) {
    collectDescendants(hop, maps, chainMocks)
  }
  collectDescendants(root, maps, chainMocks)

  const ordered: MockFile[] = [root]
  const inChain = new Set(chainMocks.map((m) => m.filename))
  const seen = new Set<string>([root.filename])

  const visit = (parentRequestId: string) => {
    const children = (maps.childrenByParent.get(parentRequestId) ?? [])
      .filter((c) => inChain.has(c.filename) && !seen.has(c.filename))
      .sort((a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime())
    for (const child of children) {
      ordered.push(child)
      seen.add(child.filename)
      if (child.requestId) visit(child.requestId)
    }
  }

  if (root.requestId) visit(root.requestId)

  const adoptedSorted = [...adoptedChildren].sort(
    (a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime()
  )
  for (const child of adoptedSorted) {
    if (seen.has(child.filename)) continue
    ordered.push(child)
    seen.add(child.filename)
    if (child.requestId) visit(child.requestId)
  }

  for (const hop of chainMocks) {
    if (!seen.has(hop.filename)) {
      ordered.push(hop)
      seen.add(hop.filename)
    }
  }
  return ordered
}

/**
 * Rebuild chains when many hops share a parentRequestId that is no longer in the catalog
 * (GraphQL hop id rewritten by always-refresh). Reattach under a nearby GraphQL when possible.
 */
function buildHealedMissingParentChains(
  mocks: MockFile[],
  maps: MockChainMaps,
  assigned: Set<string>
): MockServiceChain[] {
  const orphansByMissingParent = new Map<string, MockFile[]>()
  for (const mock of mocks) {
    if (assigned.has(mock.filename)) continue
    const parentId = mock.parentRequestId?.trim()
    if (!parentId || maps.byRequestId.has(parentId)) continue
    const list = orphansByMissingParent.get(parentId) ?? []
    list.push(mock)
    orphansByMissingParent.set(parentId, list)
  }

  const chains: MockServiceChain[] = []
  for (const [, orphans] of orphansByMissingParent) {
    if (orphans.length < 2) continue
    const healParent = findGraphqlHealParentForOrphans(orphans, mocks, assigned)
    if (!healParent?.requestId) continue

    const adopted = adoptOrphansUnderGraphqlParent(healParent, orphans)
    const hops = orderHopsWithAdoptedChildren(healParent, adopted, maps)
    if (hops.length < 2) continue
    if (isNonsensicalMockServiceChain(hops)) continue

    for (const hop of hops) assigned.add(hop.filename)
    const latestModified = hops.reduce(
      (max, hop) => (new Date(hop.modified) > new Date(max) ? hop.modified : max),
      hops[0].modified
    )
    chains.push({
      id: healParent.requestId,
      hops,
      latestModified,
      inferred: true,
      enrichedHopFilenames: [healParent.filename],
    })
  }
  return chains
}

/** Multi-hop service chains (root → downstream), newest chains first. */
export function buildMockServiceChains(mocks: MockFile[]): MockServiceChain[] {
  const maps = buildMockChainMaps(mocks)
  const assigned = new Set<string>()
  const chains: MockServiceChain[] = []

  // Heal first so myaccount is not claimed as its own root while GraphQL's old id is missing.
  chains.push(...buildHealedMissingParentChains(mocks, maps, assigned))

  for (const mock of mocks) {
    if (!mockIsInServiceChain(mock, maps)) continue
    if (!isMockChainRoot(mock, maps.byRequestId)) continue
    // Defer shared missing-parent families to heal (GraphQL → bookings/myaccount).
    if (sharesMissingParentWithSiblings(mock, mocks, maps.byRequestId)) continue
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
    if (sharesMissingParentWithSiblings(mock, mocks, maps.byRequestId)) continue
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
  const walked = new Set(seen)
  let current: MockFile | undefined = head
  while (current?.parentRequestId?.trim()) {
    if (prefix.length >= MAX_ENRICHED_ANCESTORS) {
      return []
    }
    const parent = maps.byRequestId.get(current.parentRequestId.trim())
    if (!parent || walked.has(parent.filename)) {
      break
    }
    if (parent.requestId) {
      const siblingCount = maps.childrenByParent.get(parent.requestId)?.length ?? 0
      if (siblingCount >= SESSION_FANOUT_MIN_HOPS) {
        return []
      }
    }
    prefix.unshift(parent)
    walked.add(parent.filename)
    current = parent
  }
  for (const hop of prefix) {
    seen.add(hop.filename)
  }
  return prefix
}

/**
 * Prepends missing gateway entry hops (e.g. `/aggregate`) onto id-linked chains.
 * Does not attach unrelated client calls recorded in the same session.
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

  const linked = [...ancestorPrefix, ...hops]
  const requestIds = new Set(
    linked.map((hop) => hop.requestId?.trim()).filter((id): id is string => Boolean(id))
  )

  const times = linked.map((h) => new Date(h.modified).getTime())
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const minSortKey = inferHopSortKey(linked[0])

  const pathPrepend = catalog
    .filter((mock) => {
      if (seen.has(mock.filename)) return false
      if (!isKnownInferredEntryHop(mock)) return false
      if (inferHopSortKey(mock) >= minSortKey) return false
      const parentId = mock.parentRequestId?.trim()
      if (parentId && !requestIds.has(parentId)) return false
      const t = new Date(mock.modified).getTime()
      return t >= minT - ENRICH_CHAIN_CLUSTER_MS && t <= maxT + 5_000
    })
    .sort((a, b) => inferHopSortKey(a) - inferHopSortKey(b))
    .slice(0, MAX_ENRICHED_CATALOG_HOPS)

  for (const hop of pathPrepend) {
    seen.add(hop.filename)
    enrichedFilenames.push(hop.filename)
  }

  const result = [...pathPrepend, ...linked]
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
    return linked.flatMap((chain) => {
      const enriched = enrichChainHopsForDisplay(chain.hops, mocks, maps)
      const hops = isNonsensicalMockServiceChain(enriched.hops) ? chain.hops : enriched.hops
      const enrichedHopFilenames = hops === chain.hops ? [] : enriched.enrichedHopFilenames
      if (isNonsensicalMockServiceChain(hops)) return []
      const latestModified = hops.reduce(
        (max, hop) => (new Date(hop.modified) > new Date(max) ? hop.modified : max),
        hops[0].modified
      )
      return [
        {
          ...chain,
          hops,
          latestModified,
          inferred: chain.inferred === true || enrichedHopFilenames.length > 0,
          enrichedHopFilenames,
        },
      ]
    })
  }

  return buildInferredMockServiceChains(mocks)
}

/**
 * Keep full multi-hop chains when the list is search-filtered.
 * Matching on one hop (e.g. GET /v-2/myaccount) must not drop GraphQL/token siblings.
 */
export function filterMockServiceChainsByFilenames(
  chains: MockServiceChain[],
  filenames: ReadonlySet<string>
): MockServiceChain[] {
  if (filenames.size === 0) return []
  return chains.filter((chain) => chain.hops.some((hop) => filenames.has(hop.filename)))
}

export function isEnrichedChainHop(chain: MockServiceChain, hop: MockFile): boolean {
  return chain.enrichedHopFilenames?.includes(hop.filename) === true
}

export type MockHopTrafficMode = 'live' | 'replay' | 'pending' | 'refresh'

export const MOCK_HOP_TRAFFIC_LABELS: Record<MockHopTrafficMode, string> = {
  replay: 'Replay',
  refresh: 'Refresh',
  pending: 'Pending',
  live: 'Live',
}

export function parseMockHopTrafficMode(value: string | null | undefined): MockHopTrafficMode | null {
  if (value === 'replay' || value === 'refresh' || value === 'pending' || value === 'live') {
    return value
  }
  return null
}

export function filterMocksByHopTraffic(
  mocks: MockFile[],
  traffic: MockHopTrafficMode | null,
  domain?: string | null
): MockFile[] {
  const wantedDomain = domain?.trim() ?? ''
  if (!traffic && !wantedDomain) return mocks
  return mocks.filter((mock) => {
    if (traffic && getMockHopTrafficMode(mock) !== traffic) return false
    if (wantedDomain && endpointHostname(mock.endpoint) !== wantedDomain) return false
    return true
  })
}

type MockTrafficFields = Pick<
  MockFile,
  'alwaysUseRealApi' | 'responsePending' | 'alwaysRefreshFromLive' | 'refreshOnNextRequest' | 'replayMode'
>

/**
 * Same precedence as core `resolveMockReplayMode` (refresh flags win over passthrough).
 */
function resolveMockFileReplayMode(mock: MockTrafficFields): NonNullable<MockFile['replayMode']> {
  if (mock.replayMode) return mock.replayMode
  if (mock.alwaysRefreshFromLive === true) return 'always-refresh'
  if (mock.refreshOnNextRequest === true) return 'refresh-next'
  if (mock.alwaysUseRealApi === true || mock.responsePending === true) return 'passthrough'
  return 'stored'
}

/** True when this hop calls upstream instead of returning the stored body. */
export function mockHopHitsUpstream(mock: MockTrafficFields): boolean {
  if (mock.responsePending === true) return true
  return resolveMockFileReplayMode(mock) !== 'stored'
}

export function getMockHopTrafficMode(mock: MockTrafficFields): MockHopTrafficMode {
  if (mock.responsePending === true) return 'pending'
  const mode = resolveMockFileReplayMode(mock)
  if (mode === 'stored') return 'replay'
  if (mode === 'always-refresh' || mode === 'refresh-next') return 'refresh'
  return 'live'
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
  const displayChains = buildMockServiceChainsForDisplay(catalogMocks)
  const domains = new Set<string>()
  const chainIndex = new Map<string, MockFile[]>()
  for (const chain of displayChains) {
    for (const hop of chain.hops) {
      if (!chainIndex.has(hop.filename)) chainIndex.set(hop.filename, chain.hops)
    }
  }

  const addHop = (hop: MockFile) => {
    const path = endpointToDomainPath(hop.endpoint)
    if (path) domains.add(path)
  }

  const addParents = (hops: MockFile[], filename: string) => {
    const idx = hops.findIndex((h) => h.filename === filename)
    if (idx <= 0) return false
    for (let i = 0; i < idx; i++) addHop(hops[i])
    return true
  }

  for (const mock of targetMocks) {
    const linked = getMockChain(mock, chainMaps.byRequestId, chainMaps.childrenByParent)
    addParents(linked, mock.filename)
    const displayHops = chainIndex.get(mock.filename)
    if (displayHops) addParents(displayHops, mock.filename)
  }

  return [...domains]
}

export interface DomainFolderReplayPlan {
  stored: string[]
  /** Hosts still on Replay that sit upstream of this folder (not mutated). */
  blockedByUpstream: string[]
}

/**
 * Filenames to put on saved-mock when Replay is clicked for a domain-tree folder.
 * Only this folder is updated — sibling/parent hosts keep their current Live/Replay setting.
 */
export function planDomainFolderReplay(
  catalogMocks: MockFile[],
  domainPath: string
): DomainFolderReplayPlan {
  const normalizedPath = domainPath.trim().replace(/^\/+|\/+$/g, '')
  const domainMocks = catalogMocks.filter((mock) =>
    endpointMatchesDomainPath(mock.endpoint ?? null, normalizedPath)
  )
  const stored = domainMocks.map((mock) => mock.filename)
  const storedSet = new Set(stored)
  const upstreamDomains = collectUpstreamDomainPathsForReplay(domainMocks, catalogMocks).filter(
    (path) => path !== normalizedPath
  )
  const blockedHosts = new Set<string>()
  for (const mock of catalogMocks) {
    if (storedSet.has(mock.filename)) continue
    if (getMockHopTrafficMode(mock) !== 'replay') continue
    const matchesUpstream = upstreamDomains.some((path) =>
      endpointMatchesDomainPath(mock.endpoint ?? null, path)
    )
    if (!matchesUpstream) continue
    const host = endpointHostLabel(mock.endpoint)
    if (host) blockedHosts.add(host)
  }
  return { stored, blockedByUpstream: [...blockedHosts] }
}

export function describeBulkReplayModeResult(result: {
  updatedStored: number
  updatedLive: number
  queuedRefreshNext: number
}): string {
  const parts: string[] = []
  if (result.updatedStored > 0) {
    parts.push(`${result.updatedStored} mock${result.updatedStored === 1 ? '' : 's'} on saved response`)
  }
  if (result.queuedRefreshNext > 0) {
    parts.push(`${result.queuedRefreshNext} will capture on next request, then replay`)
  }
  if (result.updatedLive > 0) {
    parts.push(
      `${result.updatedLive} parent hop${result.updatedLive === 1 ? '' : 's'} set to Live`
    )
  }
  if (parts.length === 0) {
    return 'No hops updated'
  }
  return parts.join('. ')
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
  const requestIds = new Set(
    chain.map((hop) => hop.requestId?.trim()).filter((id): id is string => Boolean(id))
  )
  return chain.some((hop, index) => {
    if (index === 0) return false
    const parentId = hop.parentRequestId?.trim()
    return Boolean(parentId && requestIds.has(parentId))
  })
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

function uniqueNodeHasHopId(node: MockUniqueChainNode): boolean {
  return node.hops.some((hop) => Boolean(hop.requestId?.trim()))
}

/**
 * Fold consecutive unique hops into a path tree so later services nest under
 * the caller even when parent-request-id links are missing (inferred chains).
 * Id-bearing orphan roots stay siblings — daisy-chaining them inverted GraphQL /
 * myaccount / bookings after always-refresh rewrote a parent id.
 */
function nestUniqueNodesAsPath(nodes: MockUniqueChainNode[]): MockUniqueChainNode[] {
  if (nodes.length <= 1) return nodes
  const roots: MockUniqueChainNode[] = [nodes[0]]
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1]
    const curr = nodes[i]
    if (uniqueNodeHasHopId(prev) && uniqueNodeHasHopId(curr)) {
      roots.push(curr)
      continue
    }
    prev.children.push(curr)
  }
  return roots
}

function buildSequentialUniquePath(hops: MockFile[]): MockUniqueChainNode[] {
  const unique: MockUniqueChainNode[] = []
  for (const hop of hops) {
    const key = mockHopEndpointFingerprint(hop)
    const last = unique[unique.length - 1]
    if (last && last.fingerprint === key) {
      last.hops.push(hop)
      last.callCount += 1
      continue
    }
    unique.push({
      fingerprint: key,
      representative: hop,
      hops: [hop],
      callCount: 1,
      children: [],
    })
  }
  return nestUniqueNodesAsPath(unique)
}

/**
 * Nested unique-endpoint forest for display. Repeated sibling calls collapse to ×N
 * (same idea as Atlas HTML unique chains) instead of a linear dump of every hop.
 * Distinct hops nest as a tree: parent-linked children stay under their caller,
 * and inferred/enriched hops without ids still nest as a path (not siblings).
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
    return nestUniqueNodesAsPath(grouped)
  }

  return buildSequentialUniquePath(hops)
}

/** Downstream call count under this node (nested levels, including repeats). */
export function countNestedMockChainCalls(node: MockUniqueChainNode): number {
  let n = 0
  for (const child of node.children) {
    n += child.callCount
    n += countNestedMockChainCalls(child)
  }
  return n
}

export function uniqueChainNodeContainsFilename(
  node: MockUniqueChainNode,
  filename: string | null | undefined
): boolean {
  if (!filename) return false
  if (node.hops.some((hop) => hop.filename === filename)) return true
  return node.children.some((child) => uniqueChainNodeContainsFilename(child, filename))
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

/** True when the node hides nested services or multiple underlying calls behind ×N. */
export function mockChainNodeCanExpand(node: MockUniqueChainNode): boolean {
  return node.children.length > 0 || node.hops.length > 1
}
