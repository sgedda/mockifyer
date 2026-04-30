import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { deleteMock, duplicateMock } from '@/lib/api'
import { buildMockFolderTree, sortFolderEntries } from '@/lib/mockFolderTree'
import { buildMockRequestTree } from '@/lib/mockRequestTree'
import { MockFolderTree, MockFolderTreeProvider, useFolderTreeBulkActions } from '@/components/MockFolderTree'
import type { MockFile, MockData } from '@/types'
import { RefreshCw, UnfoldVertical, FoldVertical } from 'lucide-react'

interface MockListProps {
  mocks: MockFile[]
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
      await deleteMock(filename)
      toast({
        title: 'Success',
        description: 'Mock deleted successfully',
      })
      onRefresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete mock',
        variant: 'destructive',
      })
    } finally {
      setDeleting(null)
    }
  }

  async function handleDuplicate(filename: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const result = await duplicateMock(filename)
      toast({
        title: 'Success',
        description: `Mock duplicated as ${result.newFilename}`,
      })
      onRefresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate mock',
        variant: 'destructive',
      })
    }
  }

  const { folderTree, hasFolders } = useMemo(() => {
    const tree = groupBy === 'domains' ? buildMockRequestTree(mocks) : buildMockFolderTree(mocks)
    return {
      folderTree: tree,
      hasFolders: sortFolderEntries(tree).length > 0,
    }
  }, [groupBy, mocks])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="🔍 Search by filename, endpoint, or method..."
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
          />
        </div>
      )}
    </div>
  )
}

