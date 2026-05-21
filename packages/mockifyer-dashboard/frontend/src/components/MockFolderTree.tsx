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
  countMocksInDomainFolder,
  findEffectiveDomainPathRule,
  type LiveApiAggregate,
} from '@/lib/domainTreeMatch'
import {
  bulkCaptureResponsesForDomain,
  bulkSetLiveApiForDomain,
  setDomainPathRule,
  type DomainPathRulesMap,
} from '@/lib/api'
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
  pathRules: DomainPathRulesMap
  onPathRulesChange: (rules: DomainPathRulesMap) => void
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

function aggregateMockReplayState(counts: ReturnType<typeof countMocksInDomainFolder>): 'all_mock' | 'mixed' | 'none' {
  if (counts.total === 0 || counts.mocked === 0) return 'none'
  const passthrough = counts.live - counts.pending
  if (counts.mocked === counts.total - counts.pending && passthrough === 0) return 'all_mock'
  return 'mixed'
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
  const [busy, setBusy] = useState<'live' | 'mock' | 'capture' | 'auto' | null>(null)

  useEffect(() => {
    if (!bulkCtx || bulkCtx.bulkGeneration === 0) return
    setOpen(bulkCtx.bulkMode === 'expand')
  }, [bulkCtx, bulkCtx?.bulkGeneration, bulkCtx?.bulkMode])

  const folderCounts = useMemo(() => {
    if (!domainTreeMode || !domainPath) return null
    return countMocksInDomainFolder(domainTreeMode.catalogMocks, domainPath)
  }, [domainTreeMode, domainPath])

  const liveState = useMemo((): LiveApiAggregate => {
    if (!folderCounts) return 'empty'
    return aggregateLiveApiState(folderCounts)
  }, [folderCounts])

  const mockReplayState = useMemo(() => {
    if (!folderCounts) return 'none' as const
    return aggregateMockReplayState(folderCounts)
  }, [folderCounts])

  const pendingCount = folderCounts?.pending ?? 0

  const effectivePathRule = useMemo(() => {
    if (!domainTreeMode || !domainPath) return null
    return findEffectiveDomainPathRule(domainPath, domainTreeMode.pathRules)
  }, [domainTreeMode, domainPath])

  const autoRecordOn = effectivePathRule?.rule.recordResponses === true
  const autoRecordExact =
    domainPath != null && domainTreeMode?.pathRules[domainPath.trim()]?.recordResponses === true

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

  async function handleMocked() {
    if (!domainTreeMode || !domainPath) return
    if (pendingCount > 0) {
      await handleBulkCapture()
    }
    await handleLiveToggle(false)
  }

  async function handleAutoRecordToggle() {
    if (!domainTreeMode || !domainPath) return
    try {
      setBusy('auto')
      let rule: { recordResponses: boolean; autoMock?: boolean } | null
      if (autoRecordExact) {
        rule = null
      } else if (autoRecordOn) {
        rule = { recordResponses: false, autoMock: false }
      } else {
        rule = { recordResponses: true, autoMock: true }
      }
      const rules = await setDomainPathRule({
        scenario: domainTreeMode.scenario,
        domainPath,
        rule,
      })
      domainTreeMode.onPathRulesChange(rules)
      const enabling = rule?.recordResponses === true
      toast({
        title: enabling ? 'Auto-record enabled' : 'Auto-record disabled',
        description: enabling
          ? `New requests under ${domainPath} will save full responses and replay automatically.`
          : autoRecordExact || autoRecordOn
            ? `Removed auto-record policy for ${domainPath}. Existing mocks unchanged.`
            : `Blocked inherited auto-record under ${domainPath}.`,
      })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update auto-record',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  const countsLabel =
    folderCounts && folderCounts.total > 0
      ? `${folderCounts.pending} pending · ${folderCounts.mocked} mocked · ${folderCounts.live - folderCounts.pending} live`
      : null

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
          <span className="min-w-0 truncate">
            <span className="font-mono">{title}</span>
            {countsLabel && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">{countsLabel}</span>
            )}
          </span>
        </button>
        {domainTreeMode && domainPath && liveState !== 'empty' && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant={autoRecordOn ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              disabled={busy !== null}
              title={
                autoRecordOn
                  ? autoRecordExact
                    ? 'New requests under this path auto-save responses and replay. Click to disable.'
                    : `Auto-record inherited from ${effectivePathRule?.domainPath}. Click to set explicit rule on this path.`
                  : 'Persist policy: new requests under this path save full responses and replay automatically'
              }
              onClick={() => void handleAutoRecordToggle()}
            >
              {busy === 'auto' ? '…' : 'Auto-record'}
            </Button>
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
              title="Existing mocks only: always call live API. Does not affect new requests unless Auto-record is on."
              onClick={() => void handleLiveToggle(true)}
            >
              {busy === 'live' ? '…' : 'Live API'}
            </Button>
            <Button
              type="button"
              variant={mockReplayState === 'all_mock' ? 'default' : mockReplayState === 'mixed' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              disabled={busy !== null}
              title={
                pendingCount > 0
                  ? 'Captures pending stubs first, then replays saved mocks. New requests stay request-only unless Auto-record is on.'
                  : 'Existing mocks only: replay saved responses. New requests stay request-only unless Auto-record is on.'
              }
              onClick={() => void handleMocked()}
            >
              {busy === 'mock' || busy === 'capture' ? '…' : mockReplayState === 'mixed' ? 'Mocked (mixed)' : 'Mocked'}
            </Button>
          </div>
        )}
      </div>
      {open && <div className="border-t border-border/60 p-3 pt-2 space-y-3">{children}</div>}
    </div>
  )
}
