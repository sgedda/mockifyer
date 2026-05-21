import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MockCard } from '@/components/MockCard'
import type { MockFile, MockData } from '@/types'
import type { MockFolderNode } from '@/lib/mockFolderTree'
import { sortFolderEntries } from '@/lib/mockFolderTree'
import {
  aggregateLiveApiState,
  countLiveApiInMocks,
  countPendingInMocks,
  type LiveApiAggregate,
} from '@/lib/domainTreeMatch'
import { bulkCaptureResponsesForDomain, bulkSetLiveApiForDomain } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronDown, Folder } from 'lucide-react'

interface FolderTreeBulkContextValue {
  /** Incremented on each Expand all / Collapse all so nested folders sync. */
  bulkGeneration: number
  bulkMode: 'expand' | 'collapse'
  expandAllFolders: () => void
  collapseAllFolders: () => void
}

const FolderTreeBulkContext = createContext<FolderTreeBulkContextValue | null>(null)

export function MockFolderTreeProvider({ children }: { children: ReactNode }) {
  const [bulkGeneration, setBulkGeneration] = useState(0)
  const [bulkMode, setBulkMode] = useState<'expand' | 'collapse'>('expand')

  const expandAllFolders = useCallback(() => {
    setBulkMode('expand')
    setBulkGeneration((g) => g + 1)
  }, [])

  const collapseAllFolders = useCallback(() => {
    setBulkMode('collapse')
    setBulkGeneration((g) => g + 1)
  }, [])

  const value = useMemo(
    () => ({
      bulkGeneration,
      bulkMode,
      expandAllFolders,
      collapseAllFolders,
    }),
    [bulkGeneration, bulkMode, expandAllFolders, collapseAllFolders]
  )

  return <FolderTreeBulkContext.Provider value={value}>{children}</FolderTreeBulkContext.Provider>
}

export function useFolderTreeBulkActions(): FolderTreeBulkContextValue {
  const ctx = useContext(FolderTreeBulkContext)
  if (!ctx) {
    throw new Error('useFolderTreeBulkActions must be used within MockFolderTreeProvider')
  }
  return ctx
}

export interface DomainTreeModeProps {
  scenario: string
  catalogMocks: MockFile[]
  onRefresh: () => void
}

interface MockFolderTreeProps {
  node: MockFolderNode
  level: number
  selectedMock: MockData | null
  onSelectMock: (file: MockFile) => void
  onDelete: (filename: string, e: React.MouseEvent) => void
  onDuplicate: (filename: string, e: React.MouseEvent) => void
  deleting: string | null
  /** When set, folder headers show domain bulk actions for this path prefix. */
  domainTreeMode?: DomainTreeModeProps
}

export function MockFolderTree({
  node,
  level,
  selectedMock,
  onSelectMock,
  onDelete,
  onDuplicate,
  deleting,
  domainTreeMode,
}: MockFolderTreeProps) {
  const folders = sortFolderEntries(node)
  const sortedFiles = [...node.files].sort((a, b) => a.filename.localeCompare(b.filename))

  return (
    <div className={level > 0 ? 'space-y-3' : 'space-y-4'}>
      {sortedFiles.map((mock) => (
        <MockCard
          key={mock.filename}
          mock={mock}
          selectedMock={selectedMock}
          onSelectMock={onSelectMock}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          deleting={deleting}
        />
      ))}
      {folders.map(({ name, child }) => (
        <FolderSection
          key={child.fullPath}
          title={name}
          defaultOpen={level < 2}
          domainPath={domainTreeMode ? child.fullPath : undefined}
          domainTreeMode={domainTreeMode}
        >
          <MockFolderTree
            node={child}
            level={level + 1}
            selectedMock={selectedMock}
            onSelectMock={onSelectMock}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            deleting={deleting}
            domainTreeMode={domainTreeMode}
          />
        </FolderSection>
      ))}
    </div>
  )
}

function FolderSection({
  title,
  defaultOpen,
  domainPath,
  domainTreeMode,
  children,
}: {
  title: string
  defaultOpen: boolean
  domainPath?: string
  domainTreeMode?: DomainTreeModeProps
  children: ReactNode
}) {
  const bulkCtx = useContext(FolderTreeBulkContext)
  const { toast } = useToast()
  const [open, setOpen] = useState(defaultOpen)
  const [busy, setBusy] = useState<'live' | 'mock' | 'capture' | null>(null)

  useEffect(() => {
    if (!bulkCtx || bulkCtx.bulkGeneration === 0) return
    setOpen(bulkCtx.bulkMode === 'expand')
  }, [bulkCtx, bulkCtx?.bulkGeneration, bulkCtx?.bulkMode])

  const liveState = useMemo((): LiveApiAggregate => {
    if (!domainTreeMode || !domainPath) return 'empty'
    const counts = countLiveApiInMocks(domainTreeMode.catalogMocks, domainPath)
    return aggregateLiveApiState(counts)
  }, [domainTreeMode, domainPath])

  const pendingCount = useMemo(() => {
    if (!domainTreeMode || !domainPath) return 0
    return countPendingInMocks(domainTreeMode.catalogMocks, domainPath)
  }, [domainTreeMode, domainPath])

  async function handleLiveToggle(useLiveApi: boolean) {
    if (!domainTreeMode || !domainPath) return
    try {
      setBusy(useLiveApi ? 'live' : 'mock')
      const result = await bulkSetLiveApiForDomain({
        scenario: domainTreeMode.scenario,
        domainPath,
        useLiveApi,
      })
      toast({
        title: useLiveApi ? 'Live API enabled' : 'Mocked enabled',
        description:
          result.skippedPending > 0
            ? `Updated ${result.updated}; ${result.skippedPending} pending (capture responses first).`
            : `Updated ${result.updated} mock(s) under ${domainPath}`,
      })
      domainTreeMode.onRefresh()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Bulk update failed',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  async function handleBulkCapture() {
    if (!domainTreeMode || !domainPath) return
    try {
      setBusy('capture')
      const result = await bulkCaptureResponsesForDomain({
        scenario: domainTreeMode.scenario,
        domainPath,
      })
      const errHint =
        result.failed > 0 && result.errors[0]?.message
          ? ` First error: ${result.errors[0].message}`
          : ''
      toast({
        title: 'Capture complete',
        description: `Captured ${result.captured}; skipped ${result.skippedAlready} already captured; ${result.failed} failed.${errHint}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      })
      domainTreeMode.onRefresh()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Bulk capture failed',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-foreground hover:opacity-80"
        >
          <Folder className="h-4 w-4 shrink-0 text-primary" />
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="font-mono truncate">{title}</span>
        </button>
        {domainTreeMode && domainPath && liveState !== 'empty' && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {pendingCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={busy !== null}
                title="Call upstream for each pending mock under this path and save response bodies"
                onClick={() => void handleBulkCapture()}
              >
                {busy === 'capture' ? '…' : `Capture (${pendingCount})`}
              </Button>
            )}
            <Button
              type="button"
              variant={liveState === 'all_live' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              disabled={busy !== null}
              title="Always call live API for mocks under this path"
              onClick={() => void handleLiveToggle(true)}
            >
              {busy === 'live' ? '…' : 'Live API'}
            </Button>
            <Button
              type="button"
              variant={liveState === 'all_mock' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              disabled={busy !== null}
              title={
                pendingCount > 0
                  ? 'Replay mocks with captured responses; pending stubs are skipped'
                  : 'Replay saved mocks under this path'
              }
              onClick={() => void handleLiveToggle(false)}
            >
              {busy === 'mock' ? '…' : 'Mocked'}
            </Button>
          </div>
        )}
      </div>
      {open && <div className="border-t border-border/60 p-3 pt-2 space-y-3">{children}</div>}
    </div>
  )
}
