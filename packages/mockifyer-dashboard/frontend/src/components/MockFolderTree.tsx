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
import { ChevronRight, ChevronDown, Folder, Radio } from 'lucide-react'
import { bulkSetLiveApiForDomain } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import {
  aggregateLiveApiState,
  countLiveApiInMocks,
  type LiveApiAggregate,
} from '@/lib/domainTreeMatch'

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

interface MockFolderTreeProps {
  node: MockFolderNode
  level: number
  selectedMock: MockData | null
  onSelectMock: (file: MockFile) => void
  onDelete: (filename: string, e: React.MouseEvent) => void
  onDuplicate: (filename: string, e: React.MouseEvent) => void
  deleting: string | null
  /** When set, folder headers show live-API toggles for this domain path prefix. */
  domainTreeMode?: {
    scenario: string
    catalogMocks: MockFile[]
    onRefresh: () => void
  }
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
          domainPath={domainTreeMode ? child.fullPath : undefined}
          domainTreeMode={domainTreeMode}
          defaultOpen={level < 2}
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

function liveApiToggleLabel(state: LiveApiAggregate): string {
  switch (state) {
    case 'all_live':
      return 'Live API'
    case 'all_mock':
      return 'Mocked'
    case 'mixed':
      return 'Mixed'
    default:
      return '—'
  }
}

function FolderSection({
  title,
  domainPath,
  domainTreeMode,
  defaultOpen,
  children,
}: {
  title: string
  domainPath?: string
  domainTreeMode?: MockFolderTreeProps['domainTreeMode']
  defaultOpen: boolean
  children: ReactNode
}) {
  const bulkCtx = useContext(FolderTreeBulkContext)
  const [open, setOpen] = useState(defaultOpen)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!bulkCtx || bulkCtx.bulkGeneration === 0) return
    setOpen(bulkCtx.bulkMode === 'expand')
  }, [bulkCtx, bulkCtx?.bulkGeneration, bulkCtx?.bulkMode])

  const liveState = useMemo(() => {
    if (!domainTreeMode || !domainPath) return 'empty' as LiveApiAggregate
    const counts = countLiveApiInMocks(domainTreeMode.catalogMocks, domainPath)
    return aggregateLiveApiState(counts)
  }, [domainTreeMode, domainPath])

  async function handleLiveToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!domainTreeMode || !domainPath) return
    const useLiveApi = liveState !== 'all_live'
    try {
      setSaving(true)
      const result = await bulkSetLiveApiForDomain({
        scenario: domainTreeMode.scenario,
        domainPath,
        useLiveApi,
      })
      toast({
        title: useLiveApi ? 'Using live API' : 'Mocks enabled',
        description:
          result.skippedPending > 0
            ? `Updated ${result.updated}; ${result.skippedPending} pending (capture response first).`
            : `Updated ${result.updated} mock(s) under ${domainPath}`,
      })
      domainTreeMode.onRefresh()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      <div className="flex w-full items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-foreground hover:bg-muted/50 rounded-md min-w-0"
        >
          <Folder className="h-4 w-4 shrink-0 text-primary" />
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="font-mono truncate">{title}</span>
        </button>
        {domainTreeMode && domainPath && liveState !== 'empty' && (
          <button
            type="button"
            disabled={saving}
            onClick={(e) => void handleLiveToggle(e)}
            title={
              liveState === 'all_live'
                ? 'All requests under this path use live API — click to enable mocks'
                : liveState === 'mixed'
                  ? 'Some mocks active — click to set all to live API'
                  : 'All mocks active — click to force live API for this subtree'
            }
            className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${
              liveState === 'all_live'
                ? 'border-primary/40 bg-primary/15 text-primary'
                : liveState === 'mixed'
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                  : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            <Radio className="h-3 w-3" />
            {liveApiToggleLabel(liveState)}
          </button>
        )}
      </div>
      {open && <div className="border-t border-border/60 p-3 pt-2 space-y-3">{children}</div>}
    </div>
  )
}
