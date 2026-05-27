import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { deleteMock, duplicateMock, fetchDomainPathRules, type DomainPathRulesMap } from '@/lib/api'
import { buildMockFolderTree, sortFolderEntries } from '@/lib/mockFolderTree'
import { buildMockRequestTree } from '@/lib/mockRequestTree'
import { buildMockChainMaps, buildMockServiceChainsForDisplay } from '@/lib/mock-correlation-chains'
import { MockFolderTree, MockFolderTreeProvider, useFolderTreeBulkActions } from '@/components/MockFolderTree'
import { MockCard } from '@/components/MockCard'
import { MockServiceChainCard } from '@/components/MockServiceChainCard'
import type { MockFile, MockData, SimilarBodyGroupSummary } from '@/types'
import { RefreshCw, UnfoldVertical, FoldVertical, ChevronDown, ChevronRight, Link2, GitBranch } from 'lucide-react'

interface MockListProps {
  mocks: MockFile[]
  /** Unfiltered mocks for the active scenario (used for "Recent" section). */
  allMocks: MockFile[]
  /** Clusters of GraphQL mocks with nearly identical query documents (from GET /mocks?similarGroups=1). */
  similarBodyGroups?: SimilarBodyGroupSummary[]
  /** Active scenario (same as mock list fetch); required for correct Redis/mock path on delete/duplicate. */
  scenario?: string
  /** When true, delete/duplicate actions are hidden (scenario locked server-side). */
  scenarioLocked?: boolean
  loading: boolean
  loadingMock?: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedMock: MockData | null
  onSelectMock: (file: MockFile) => void
  onRefresh: () => void
}

export default function MockList(props: MockListProps) {
  return (
    <MockFolderTreeProvider>
      <MockListContent {...props} />
    </MockFolderTreeProvider>
  )
}

function MockListContent({
  mocks,
  allMocks,
  similarBodyGroups = [],
  scenario,
  scenarioLocked = false,
  loading,
  loadingMock = false,
  searchQuery,
  onSearchChange,
  selectedMock,
  onSelectMock,
  onRefresh,
}: MockListProps) {
  const { toast } = useToast()
  const { expandAllFolders, collapseAllFolders } = useFolderTreeBulkActions()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'folders' | 'domains' | 'chains'>('folders')
  const [domainPathRules, setDomainPathRules] = useState<DomainPathRulesMap>({})
  const didAutoSwitchGroupBy = useRef(false)
  const [overridesCollapsed, setOverridesCollapsed] = useState(true)
  const [recentCollapsed, setRecentCollapsed] = useState(true)
  const [similarClustersCollapsed, setSimilarClustersCollapsed] = useState(false)
  const [serviceChainsCollapsed, setServiceChainsCollapsed] = useState(false)
  const didSuggestChainsView = useRef(false)
  const [chainsOnly, setChainsOnly] = useState(false)

  function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message
    return 'Unexpected error'
  }

  const chainSource = searchQuery.trim() ? mocks : allMocks

  /** Redis-backed mocks with real URLs — use Domains (not redis/ filename folders) for Live/Replay. */
  const preferDomainsGrouping = useMemo(() => {
    if (!chainSource.length) return false
    const redisLike = chainSource.every(
      (m) => m.filename.startsWith('redis/') || !m.filename.includes('/')
    )
    const hasEndpoints = chainSource.some(
      (m) => typeof m.endpoint === 'string' && /^https?:\/\//i.test(m.endpoint)
    )
    return redisLike && hasEndpoints
  }, [chainSource])

  const groupByModes = preferDomainsGrouping
    ? (['domains', 'chains'] as const)
    : (['folders', 'domains', 'chains'] as const)

  useEffect(() => {
    if (didAutoSwitchGroupBy.current || loading || !mocks?.length) return

    const source = searchQuery.trim() ? mocks : allMocks
    const chains = buildMockServiceChainsForDisplay(source)
    if (chains.length > 0) {
      setGroupBy('chains')
      setServiceChainsCollapsed(false)
      didAutoSwitchGroupBy.current = true
      didSuggestChainsView.current = true
      return
    }

    const looksLikeRedisFilenames = mocks.every((m) => m.filename.startsWith('redis/'))
    const hasAbsoluteEndpoints = mocks.some(
      (m) => typeof m.endpoint === 'string' && /^https?:\/\//i.test(m.endpoint)
    )
    if (looksLikeRedisFilenames && hasAbsoluteEndpoints) {
      setGroupBy('domains')
      didAutoSwitchGroupBy.current = true
    }
  }, [loading, mocks, allMocks, searchQuery])

  useEffect(() => {
    if (preferDomainsGrouping && groupBy === 'folders') {
      setGroupBy('domains')
    }
  }, [preferDomainsGrouping, groupBy])

  useEffect(() => {
    if (!scenario || (groupBy !== 'domains' && !preferDomainsGrouping)) {
      if (groupBy !== 'domains') setDomainPathRules({})
      return
    }
    let cancelled = false
    void fetchDomainPathRules(scenario)
      .then((rules) => {
        if (!cancelled) setDomainPathRules(rules)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDomainPathRules({})
          toast({
            title: 'Could not load record response rules',
            description: error instanceof Error ? error.message : 'Request failed',
            variant: 'destructive',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [groupBy, scenario, mocks, toast, preferDomainsGrouping])

  async function handleDelete(filename: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return

    try {
      setDeleting(filename)
      await deleteMock(filename, scenario)
      toast({
        title: 'Success',
        description: 'Mock deleted successfully',
      })
      onRefresh()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: errorMessage(error) || 'Failed to delete mock',
        variant: 'destructive',
      })
    } finally {
      setDeleting(null)
    }
  }

  async function handleDuplicate(filename: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const result = await duplicateMock(filename, scenario)
      toast({
        title: 'Success',
        description: `Mock duplicated as ${result.newFilename}`,
      })
      onRefresh()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: errorMessage(error) || 'Failed to duplicate mock',
        variant: 'destructive',
      })
    }
  }

  function selectMockByFilename(filename: string) {
    const hit = allMocks.find((m) => m.filename === filename) ?? mocks.find((m) => m.filename === filename)
    if (hit) {
      onSelectMock(hit)
      return
    }
    toast({
      title: 'Mock not in list',
      description: `Could not find "${filename}" in the loaded scenario. Try clearing search or refreshing.`,
      variant: 'destructive',
    })
  }

  const chainMaps = useMemo(() => buildMockChainMaps(chainSource), [chainSource])

  const serviceChains = useMemo(() => buildMockServiceChainsForDisplay(chainSource), [chainSource])

  const displayedMocks = useMemo(() => {
    if (!chainsOnly) return mocks
    const inChain = new Set<string>()
    for (const chain of serviceChains) {
      for (const hop of chain.hops) inChain.add(hop.filename)
    }
    return mocks.filter((m) => inChain.has(m.filename))
  }, [chainsOnly, mocks, serviceChains])

  const { folderTree, hasFolders } = useMemo(() => {
    if (groupBy === 'chains') {
      return { folderTree: buildMockFolderTree([]), hasFolders: false }
    }
    const tree =
      groupBy === 'domains' ? buildMockRequestTree(displayedMocks) : buildMockFolderTree(displayedMocks)
    return {
      folderTree: tree,
      hasFolders: sortFolderEntries(tree).length > 0,
    }
  }, [groupBy, displayedMocks])

  const chainsInView = useMemo(() => {
    if (groupBy === 'chains') {
      return buildMockServiceChainsForDisplay(displayedMocks)
    }
    return serviceChains
  }, [groupBy, displayedMocks, serviceChains])

  const recentMocks = useMemo(() => {
    const source = searchQuery.trim() ? mocks : allMocks
    return [...source]
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      .slice(0, 5)
  }, [allMocks, mocks, searchQuery])

  const overrideMocks = useMemo(() => {
    const source = searchQuery.trim() ? mocks : allMocks
    return [...source]
      .filter((m) => m.hasResponseDateOverrides === true)
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  }, [allMocks, mocks, searchQuery])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="🔍 Search mocks (URL, GraphQL query, variables, response body, …)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="min-w-[12rem] flex-1"
          disabled={loading}
        />
        {!loading && mocks.length > 0 && (
          <div
            className="inline-flex h-9 shrink-0 overflow-hidden rounded-md border border-border"
            title={
              preferDomainsGrouping
                ? 'Group by service host (Live/Replay) or by call chain'
                : 'Group by filename folder, service host, or call chain'
            }
          >
            {groupByModes.map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={groupBy === mode ? 'default' : 'ghost'}
                size="sm"
                className="h-9 rounded-none border-0 px-3 text-xs shadow-none gap-1"
                onClick={() => setGroupBy(mode)}
              >
                {mode === 'folders' ? 'Folders' : mode === 'domains' ? 'Domains' : 'Chains'}
              </Button>
            ))}
          </div>
        )}
        {!loading && serviceChains.length > 0 && (
          <Button
            type="button"
            variant={chainsOnly ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setChainsOnly((v) => !v)}
            title="Show only mocks that are part of a multi-service chain"
          >
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Chains only</span>
          </Button>
        )}
        {!loading && hasFolders && mocks.length > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={expandAllFolders}
              title="Expand all folders"
            >
              <UnfoldVertical className="h-4 w-4" />
              <span className="hidden sm:inline">Expand all</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={collapseAllFolders}
              title="Collapse all folders"
            >
              <FoldVertical className="h-4 w-4" />
              <span className="hidden sm:inline">Collapse all</span>
            </Button>
          </>
        )}
        <Button onClick={onRefresh} variant="outline" size="icon" className="shrink-0" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {!loading && overrideMocks.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setOverridesCollapsed((c) => !c)}
              title={overridesCollapsed ? 'Expand overrides' : 'Collapse overrides'}
            >
              <div className="flex items-center gap-2">
                {overridesCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="text-sm font-medium">
                  Overrides {searchQuery.trim() ? '(matching search)' : ''}{' '}
                  <span className="text-xs text-muted-foreground">({overrideMocks.length})</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Sorted by modified time</div>
            </button>
            {!overridesCollapsed && (
              <div className="flex flex-col gap-2">
                {overrideMocks.map((m) => (
                  <MockCard
                    key={`override:${m.filename}`}
                    mock={m}
                    selectedMock={selectedMock}
                    onSelectMock={onSelectMock}
                    showActions={false}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && groupBy !== 'chains' && serviceChains.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setServiceChainsCollapsed((c) => !c)}
              title={serviceChainsCollapsed ? 'Expand service chains' : 'Collapse service chains'}
            >
              <div className="flex items-center gap-2">
                {serviceChainsCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <div className="text-sm font-medium">
                  Service chains{' '}
                  <span className="text-xs text-muted-foreground">
                    ({serviceChains.length} multi-hop{serviceChains.length === 1 ? '' : 's'})
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setGroupBy('chains')
                }}
              >
                View all as chains →
              </Button>
            </button>
            {!serviceChainsCollapsed && (
              <div className="space-y-3">
                {serviceChains.slice(0, 6).map((chain) => (
                  <MockServiceChainCard
                    key={chain.id}
                    chain={chain}
                    selectedFilename={selectedMock?.filename ?? null}
                    onSelectHop={onSelectMock}
                  />
                ))}
                {serviceChains.length > 6 && (
                  <p className="text-xs text-muted-foreground">
                    Showing 6 newest chains. Switch Group to <strong>Chains</strong> for the full list.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading &&
        groupBy !== 'chains' &&
        serviceChains.length === 0 &&
        chainSource.some((m) => m.parentRequestId) && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Some mocks have a parent request id but are not linked into a full chain yet. Re-run{' '}
              <span className="font-mono text-foreground">dev:proxy:record</span> so each hop saves correlation ids
              (same as the Network tab).
            </CardContent>
          </Card>
        )}

      {!loading && similarBodyGroups.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setSimilarClustersCollapsed((c) => !c)}
              title={similarClustersCollapsed ? 'Expand similar bodies' : 'Collapse similar bodies'}
            >
              <div className="flex items-center gap-2">
                {similarClustersCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <div className="text-sm font-medium">
                  Near-duplicate GraphQL bodies{' '}
                  <span className="text-xs text-muted-foreground">({similarBodyGroups.length} groups)</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Same URL, method, op, variables — similar query text</div>
            </button>
            {!similarClustersCollapsed && (
              <div className="space-y-3">
                {similarBodyGroups.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-md border border-border/60 bg-muted/15 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{g.operationName || 'GraphQL'}</span>
                      <span aria-hidden>·</span>
                      <span>{g.size} mocks</span>
                      <span aria-hidden>·</span>
                      <span>min token overlap {(g.minSimilarity * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.filenames.map((fn) => (
                        <Button
                          key={fn}
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 max-w-[min(100%,24rem)] truncate font-mono text-xs"
                          title={fn}
                          onClick={() => selectMockByFilename(fn)}
                        >
                          {fn.includes('/') ? fn.split('/').pop()! : fn}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && recentMocks.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setRecentCollapsed((c) => !c)}
              title={recentCollapsed ? 'Expand recent' : 'Collapse recent'}
            >
              <div className="flex items-center gap-2">
                {recentCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="text-sm font-medium">
                  Recent {searchQuery.trim() ? '(matching search)' : ''} (last 5 saved)
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Sorted by modified time</div>
            </button>
            {!recentCollapsed && (
              <div className="flex flex-col gap-2">
                {recentMocks.map((m) => (
                  <MockCard
                    key={`recent:${m.filename}`}
                    mock={m}
                    selectedMock={selectedMock}
                    onSelectMock={onSelectMock}
                    showActions={false}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading && mocks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">Loading mocks...</div>
          </CardContent>
        </Card>
      ) : groupBy === 'chains' && chainsInView.length === 0 ? (
        <Card>
          <CardContent className="p-6 space-y-2 text-center text-muted-foreground text-sm">
            <p>No linked service chains in this scenario yet.</p>
            <p>
              Record via dashboard proxy (<span className="font-mono">dev:proxy:record</span>) and trigger a
              multi-service flow — each hop should appear here in order, like the Network tab.
            </p>
          </CardContent>
        </Card>
      ) : displayedMocks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              {chainsOnly
                ? 'No multi-service chains in the current list'
                : searchQuery
                  ? 'No mocks found matching your search'
                  : 'No mocks found'}
            </div>
          </CardContent>
        </Card>
      ) : groupBy === 'chains' ? (
        <div className="relative space-y-4">
          {(loading || loadingMock) && (
            <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/60 pt-8 text-sm text-muted-foreground backdrop-blur-[1px]">
              {loadingMock ? 'Loading mock…' : 'Refreshing mocks…'}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Each card is one user request across services. Hop 1 is the entry service; later hops were triggered by
            the previous service (parent request id).
          </p>
          {chainsInView.map((chain) => (
            <MockServiceChainCard
              key={chain.id}
              chain={chain}
              selectedFilename={selectedMock?.filename ?? null}
              onSelectHop={onSelectMock}
            />
          ))}
        </div>
      ) : (
        <div className="relative space-y-4">
          {(loading || loadingMock) && (
            <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/60 pt-8 text-sm text-muted-foreground backdrop-blur-[1px]">
              {loadingMock ? 'Loading mock…' : 'Refreshing mocks…'}
            </div>
          )}
          <MockFolderTree
            node={folderTree}
            level={0}
            selectedMock={selectedMock}
            onSelectMock={onSelectMock}
            onDelete={scenarioLocked ? undefined : handleDelete}
            onDuplicate={scenarioLocked ? undefined : handleDuplicate}
            deleting={deleting}
            chainMaps={chainMaps}
            domainTreeMode={
              groupBy === 'domains' && scenario
                ? {
                    scenario,
                    catalogMocks: displayedMocks,
                    pathRules: domainPathRules,
                    onPathRulesChange: setDomainPathRules,
                    onRefresh,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

