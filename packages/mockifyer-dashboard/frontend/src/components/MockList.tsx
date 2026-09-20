import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { deleteMock, duplicateMock, fetchDomainPathRules, type DomainPathRulesMap } from '@/lib/api'
import { buildMockFolderTree, sortFolderEntries } from '@/lib/mockFolderTree'
import { buildMockRequestTree } from '@/lib/mockRequestTree'
import {
  buildMockChainMaps,
  buildMockServiceChainsForDisplay,
  filterMocksByHopTraffic,
  MOCK_HOP_TRAFFIC_LABELS,
  parseMockHopTrafficMode,
} from '@/lib/mock-correlation-chains'
import { HopsNavCard } from '@/components/ServiceChainList'
import { MockChainRoleReplayMenu } from '@/components/MockChainRoleReplayMenu'
import { countServiceChainHops } from '@/lib/use-mock-service-chains'
import { MockFolderTree, MockFolderTreeProvider, useFolderTreeBulkActions } from '@/components/MockFolderTree'
import { MockCard } from '@/components/MockCard'
import type { MockFile, MockData, SimilarBodyGroupSummary } from '@/types'
import { Link } from 'react-router-dom'
import { RefreshCw, UnfoldVertical, FoldVertical, ChevronDown, ChevronRight, Link2, SlidersHorizontal, Star, X } from 'lucide-react'
import { DASHBOARD_Q, hopsPath, overridesPath } from '@/lib/dashboard-urls'
import { useLocationQuery } from '@/lib/use-location-query'
import { useMockFavorites } from '@/lib/favorites-context'

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
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedMock?: MockData | null
  onSelectMock: (file: MockFile) => void
  onRefresh: () => void
  onCatalogReplayApplied?: (stored: string[], passthrough: string[]) => void
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
  searchQuery,
  onSearchChange,
  selectedMock = null,
  onSelectMock,
  onRefresh,
  onCatalogReplayApplied,
}: MockListProps) {
  const { toast } = useToast()
  const { searchParams, patch } = useLocationQuery()
  const trafficFilter = parseMockHopTrafficMode(searchParams.get(DASHBOARD_Q.traffic))
  const domainFilter = searchParams.get(DASHBOARD_Q.domain)?.trim() || ''
  const { expandAllFolders, collapseAllFolders } = useFolderTreeBulkActions()
  const { favoriteIds, favoritesOnly, setFavoritesOnly, loading: favoritesLoading } = useMockFavorites()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'folders' | 'domains'>('folders')
  const [domainPathRules, setDomainPathRules] = useState<DomainPathRulesMap>({})
  const didAutoSwitchGroupBy = useRef(false)
  const [recentCollapsed, setRecentCollapsed] = useState(true)
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false)
  const [similarClustersCollapsed, setSimilarClustersCollapsed] = useState(false)
  const [searchDraft, setSearchDraft] = useState(searchQuery)

  useEffect(() => {
    setSearchDraft(searchQuery)
  }, [searchQuery])

  const scopedMocks = useMemo(
    () => filterMocksByHopTraffic(mocks, trafficFilter, domainFilter),
    [mocks, trafficFilter, domainFilter]
  )
  const scopedAllMocks = useMemo(
    () => filterMocksByHopTraffic(allMocks, trafficFilter, domainFilter),
    [allMocks, trafficFilter, domainFilter]
  )

  const matchingFavoriteMocks = useMemo(() => {
    if (favoritesLoading) return []
    const source = searchQuery.trim() ? scopedMocks : scopedAllMocks
    return source.filter((m) => m.requestHash != null && favoriteIds.has(m.requestHash))
  }, [scopedAllMocks, scopedMocks, searchQuery, favoriteIds, favoritesLoading])

  const visibleMocks = useMemo(() => {
    if (!favoritesOnly || favoritesLoading) return scopedMocks
    return scopedMocks.filter((m) => m.requestHash != null && favoriteIds.has(m.requestHash))
  }, [favoritesOnly, favoritesLoading, scopedMocks, favoriteIds])

  const visibleAllMocks = useMemo(() => {
    if (!favoritesOnly || favoritesLoading) return scopedAllMocks
    return scopedAllMocks.filter((m) => m.requestHash != null && favoriteIds.has(m.requestHash))
  }, [favoritesOnly, favoritesLoading, scopedAllMocks, favoriteIds])

  function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message
    return 'Unexpected error'
  }

  /** Always the scenario catalog — search must not drop parent/child hops from chain building. */
  const chainSource = visibleAllMocks

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
    ? (['domains'] as const)
    : (['folders', 'domains'] as const)

  useEffect(() => {
    if (didAutoSwitchGroupBy.current || loading || !mocks?.length) return

    const looksLikeRedisFilenames = mocks.every((m) => m.filename.startsWith('redis/'))
    const hasAbsoluteEndpoints = mocks.some(
      (m) => typeof m.endpoint === 'string' && /^https?:\/\//i.test(m.endpoint)
    )
    if (looksLikeRedisFilenames && hasAbsoluteEndpoints) {
      setGroupBy('domains')
      didAutoSwitchGroupBy.current = true
    }
  }, [loading, mocks])

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

  const catalogServiceChains = useMemo(
    () => buildMockServiceChainsForDisplay(chainSource),
    [chainSource]
  )
  const catalogHopCount = countServiceChainHops(catalogServiceChains)

  const { folderTree, hasFolders } = useMemo(() => {
    const tree =
      groupBy === 'domains' ? buildMockRequestTree(visibleMocks) : buildMockFolderTree(visibleMocks)
    return {
      folderTree: tree,
      hasFolders: sortFolderEntries(tree).length > 0,
    }
  }, [groupBy, visibleMocks])

  const recentMocks = useMemo(() => {
    const source = searchQuery.trim() ? visibleMocks : visibleAllMocks
    return [...source]
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      .slice(0, 5)
  }, [visibleAllMocks, visibleMocks, searchQuery])

  const overrideMocks = useMemo(() => {
    const source = searchQuery.trim() ? visibleMocks : visibleAllMocks
    return [...source]
      .filter(
        (m) =>
          m.hasResponseDateOverrides === true || m.hasResponseFieldOverrides === true
      )
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  }, [visibleAllMocks, visibleMocks, searchQuery])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="min-w-[12rem] flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            onSearchChange(searchDraft)
          }}
        >
          <Input
            type="search"
            enterKeyHint="search"
            placeholder='Search mocks — press Enter. Words are AND; "quotes" keep a phrase'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              onSearchChange(searchDraft)
            }}
            className="w-full"
            aria-label="Search mocks"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
        <label
          className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm"
          title="Show only starred requests that exist in this scenario"
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
            disabled={loading}
          />
          <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
          <span className="hidden sm:inline">Favorites only</span>
        </label>
        {(trafficFilter || domainFilter) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            onClick={() => patch({ [DASHBOARD_Q.traffic]: null, [DASHBOARD_Q.domain]: null })}
            title="Clear replay-mode and domain filters"
          >
            <span className="truncate max-w-[14rem]">
              {[trafficFilter ? MOCK_HOP_TRAFFIC_LABELS[trafficFilter] : null, domainFilter || null]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {!loading && mocks.length > 0 && groupByModes.length > 1 && (
          <div
            className="inline-flex h-9 shrink-0 overflow-hidden rounded-md border border-border"
            title={
              preferDomainsGrouping
                ? 'Group by service host (Live/Replay)'
                : 'Group by filename folder or service host'
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
                {mode === 'folders' ? 'Folders' : 'Domains'}
              </Button>
            ))}
          </div>
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
        {scenario && catalogServiceChains.length > 0 && (
          <MockChainRoleReplayMenu
            scenario={scenario}
            chains={catalogServiceChains}
            onDone={onRefresh}
            onCatalogReplayApplied={onCatalogReplayApplied}
            disabled={loading || scenarioLocked}
          />
        )}
        <Button onClick={onRefresh} variant="outline" size="icon" className="shrink-0" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {!loading && overrideMocks.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <Link
              to={overridesPath(undefined, { scenario })}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <div className="text-sm font-medium">
                  {overrideMocks.length} mock{overrideMocks.length === 1 ? '' : 's'} with overlays
                </div>
              </div>
              <div className="text-xs text-primary">Open Overrides →</div>
            </Link>
          </CardContent>
        </Card>
      )}

      {!loading && !favoritesOnly && matchingFavoriteMocks.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setFavoritesCollapsed((c) => !c)}
              title={favoritesCollapsed ? 'Expand favorites' : 'Collapse favorites'}
            >
              <div className="flex items-center gap-2">
                {favoritesCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" aria-hidden />
                <div className="text-sm font-medium">
                  Favorites{' '}
                  <span className="text-xs text-muted-foreground">
                    ({matchingFavoriteMocks.length} in this scenario)
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Global stars, matching requests only</div>
            </button>
            {!favoritesCollapsed && (
              <div className="flex flex-col gap-2">
                {matchingFavoriteMocks.map((m) => (
                  <MockCard
                    key={`favorite:${m.filename}`}
                    mock={m}
                    selectedMock={selectedMock}
                    onSelectMock={onSelectMock}
                    showActions={false}
                    scenario={scenario}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && catalogServiceChains.length > 0 && (
        <HopsNavCard
          chainCount={catalogServiceChains.length}
          hopCount={catalogHopCount}
          scenario={scenario}
        />
      )}

      {!loading &&
        catalogServiceChains.length === 0 &&
        chainSource.some((m) => m.parentRequestId) && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Some mocks have a parent request id but are not linked into a full chain yet. Open{' '}
              <Link to={hopsPath({ scenario })} className="text-primary hover:underline">
                Hops
              </Link>{' '}
              or re-run <span className="font-mono text-foreground">dev:proxy:record</span> so each hop
              saves correlation ids.
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
                    scenario={scenario}
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
      ) : visibleMocks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              {favoritesOnly
                ? 'No favorite requests match this scenario'
                : searchQuery
                  ? 'No mocks found matching your search'
                  : trafficFilter || domainFilter
                    ? 'No mocks match this replay mode or domain'
                    : 'No mocks found'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="relative space-y-4">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/60 pt-8 text-sm text-muted-foreground backdrop-blur-[1px]">
              Refreshing mocks…
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
            scenario={scenario}
            domainTreeMode={
              groupBy === 'domains' && scenario
                ? {
                    scenario,
                    catalogMocks: visibleMocks,
                    actionMocks: allMocks,
                    pathRules: domainPathRules,
                    onPathRulesChange: setDomainPathRules,
                    onRefresh,
                    onCatalogReplayApplied,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

