import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { deleteMock, duplicateMock } from '@/lib/api'
import { buildMockFolderTree, sortFolderEntries } from '@/lib/mockFolderTree'
import { buildMockRequestTree } from '@/lib/mockRequestTree'
import { MockFolderTree, MockFolderTreeProvider, useFolderTreeBulkActions } from '@/components/MockFolderTree'
import { MockCard } from '@/components/MockCard'
import type { MockFile, MockData, SimilarBodyGroupSummary } from '@/types'
import { RefreshCw, UnfoldVertical, FoldVertical, ChevronDown, ChevronRight, Link2 } from 'lucide-react'

interface MockListProps {
  mocks: MockFile[]
  /** Unfiltered mocks for the active scenario (used for "Recent" section). */
  allMocks: MockFile[]
  /** Clusters of GraphQL mocks with nearly identical query documents (from GET /mocks?similarGroups=1). */
  similarBodyGroups?: SimilarBodyGroupSummary[]
  /** Active scenario (same as mock list fetch); required for correct Redis/mock path on delete/duplicate. */
  scenario?: string
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
  const [groupBy, setGroupBy] = useState<'folders' | 'domains'>('folders')
  const didAutoSwitchGroupBy = useRef(false)
  const [overridesCollapsed, setOverridesCollapsed] = useState(true)
  const [recentCollapsed, setRecentCollapsed] = useState(true)
  const [similarClustersCollapsed, setSimilarClustersCollapsed] = useState(false)

  function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message
    return 'Unexpected error'
  }

  useEffect(() => {
    if (didAutoSwitchGroupBy.current) return
    if (loading) return
    if (!mocks || mocks.length === 0) return

    // Heuristic: Redis-backed mocks are displayed as `redis/<hash>.json` filenames.
    // In that case, the folder view is not very helpful; prefer grouping by request source (domain).
    const looksLikeRedisFilenames = mocks.every((m) => m.filename.startsWith('redis/'))
    const hasAbsoluteEndpoints = mocks.some((m) => typeof m.endpoint === 'string' && /^https?:\/\//i.test(m.endpoint))
    if (looksLikeRedisFilenames && hasAbsoluteEndpoints) {
      setGroupBy('domains')
      didAutoSwitchGroupBy.current = true
    }
  }, [loading, mocks])

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

  const { folderTree, hasFolders } = useMemo(() => {
    const tree = groupBy === 'domains' ? buildMockRequestTree(mocks) : buildMockFolderTree(mocks)
    return {
      folderTree: tree,
      hasFolders: sortFolderEntries(tree).length > 0,
    }
  }, [groupBy, mocks])

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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setGroupBy((g) => (g === 'folders' ? 'domains' : 'folders'))}
            title={groupBy === 'folders' ? 'Group by domain + path' : 'Group by filename folders'}
          >
            Group: {groupBy === 'folders' ? 'Folders' : 'Domains'}
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
      ) : mocks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              {searchQuery ? 'No mocks found matching your search' : 'No mocks found'}
            </div>
          </CardContent>
        </Card>
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
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            deleting={deleting}
            domainTreeMode={
              groupBy === 'domains' && scenario
                ? { scenario, catalogMocks: allMocks, onRefresh }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

