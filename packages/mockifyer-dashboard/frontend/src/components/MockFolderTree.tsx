import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { MockCard } from '@/components/MockCard'
import type { MockFile, MockData } from '@/types'
import type { MockFolderNode } from '@/lib/mockFolderTree'
import {
  collectUpstreamDomainPathsForReplay,
  type MockChainMaps,
} from '@/lib/mock-correlation-chains'
import { sortFolderEntries } from '@/lib/mockFolderTree'
import {
  aggregateLiveApiState,
  countMocksInDomainFolder,
  endpointMatchesDomainPath,
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

const FOLDER_NEST_PAD_REM = 0.75
const DOMAIN_RECORD_RESPONSE_BTN_WIDTH = '7.75rem'
const DOMAIN_CAPTURE_BTN_WIDTH = '6.75rem'

function folderHeaderInsetStyle(depth: number): CSSProperties {
  if (depth <= 0) {
    return {
      paddingLeft: `${FOLDER_NEST_PAD_REM}rem`,
      paddingRight: `${FOLDER_NEST_PAD_REM}rem`,
    }
  }
  return {
    marginLeft: `calc(-${FOLDER_NEST_PAD_REM}rem * ${depth})`,
    marginRight: `calc(-${FOLDER_NEST_PAD_REM}rem * ${depth})`,
    paddingLeft: `calc(${FOLDER_NEST_PAD_REM}rem * (${depth} + 1))`,
    paddingRight: `${FOLDER_NEST_PAD_REM}rem`,
  }
}

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
  onDelete?: (filename: string, e: React.MouseEvent) => void
  onDuplicate?: (filename: string, e: React.MouseEvent) => void
  deleting: string | null
  /** When set, folder headers show domain bulk actions for this path prefix. */
  domainTreeMode?: DomainTreeModeProps
  /** For multi-service hop badges and indentation. */
  chainMaps?: MockChainMaps
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
  chainMaps,
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
          chainMaps={chainMaps}
        />
      ))}
      {folders.map(({ name, child }) => (
        <FolderSection
          key={child.fullPath}
          title={name}
          depth={level}
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
            chainMaps={chainMaps}
          />
        </FolderSection>
      ))}
    </div>
  )
}

function FolderSection({
  title,
  depth,
  defaultOpen,
  domainPath,
  domainTreeMode,
  children,
}: {
  title: string
  depth: number
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

  const pendingCount = folderCounts?.pending ?? 0
  const recordedCount = folderCounts?.recorded ?? 0
  const canReplay = recordedCount > 0

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
        title: useLiveApi ? 'Live API enabled' : 'Replay mocks enabled',
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

  async function handleSetReplayMode() {
    if (!domainTreeMode || !domainPath) return
    if (pendingCount > 0) {
      await handleBulkCapture()
    }

    const normalizedPath = domainPath.trim().replace(/^\/+|\/+$/g, '')
    const domainMocks = domainTreeMode.catalogMocks.filter((m) =>
      endpointMatchesDomainPath(m.endpoint ?? null, normalizedPath)
    )
    const upstreamDomains = collectUpstreamDomainPathsForReplay(
      domainMocks,
      domainTreeMode.catalogMocks
    ).filter((path) => path !== normalizedPath)

    try {
      setBusy('mock')
      for (const upstream of upstreamDomains) {
        await bulkSetLiveApiForDomain({
          scenario: domainTreeMode.scenario,
          domainPath: upstream,
          useLiveApi: true,
        })
      }
      const result = await bulkSetLiveApiForDomain({
        scenario: domainTreeMode.scenario,
        domainPath,
        useLiveApi: false,
      })
      const upstreamHint =
        upstreamDomains.length > 0
          ? `Set ${upstreamDomains.length} upstream hop${upstreamDomains.length === 1 ? '' : 's'} to Live so traffic reaches this service. `
          : ''
      const pendingHint =
        result.skippedPending > 0
          ? `Updated ${result.updated}; ${result.skippedPending} pending (capture responses first).`
          : `Updated ${result.updated} mock(s) under ${domainPath}.`
      toast({
        title: 'Replay enabled',
        description: `${upstreamHint}${pendingHint}`,
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

  async function handleTrafficModeChange(mode: 'live' | 'replay') {
    if (mode === 'live') {
      if (liveState === 'all_live') return
      await handleLiveToggle(true)
      return
    }
    if (liveState === 'all_mock' && pendingCount === 0) return
    await handleSetReplayMode()
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
        title: enabling ? 'Record response enabled' : 'Record response disabled',
        description: enabling
          ? `New requests under ${domainPath} will save full responses and replay automatically.`
          : autoRecordExact || autoRecordOn
            ? `Removed record-response policy for ${domainPath}. Existing mocks unchanged.`
            : `Blocked inherited record-response policy under ${domainPath}.`,
      })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update record response policy',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  const liveActive = liveState === 'all_live'
  const replayActive = canReplay && liveState === 'all_mock'
  const trafficMixed = canReplay && liveState === 'mixed'

  const countsLabel =
    folderCounts && folderCounts.total > 0
      ? `${folderCounts.pending} pending · ${folderCounts.mocked} mocked · ${folderCounts.live - folderCounts.pending} live`
      : null

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      <div
        className="flex items-center gap-3 py-2"
        style={folderHeaderInsetStyle(depth)}
      >
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
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant={autoRecordOn ? 'default' : 'outline'}
              size="sm"
              className="h-7 shrink-0 text-xs"
              style={{ width: DOMAIN_RECORD_RESPONSE_BTN_WIDTH }}
              disabled={busy !== null}
              title={
                autoRecordOn
                  ? autoRecordExact
                    ? 'New requests under this path save responses and replay. Click to disable.'
                    : `Record response inherited from ${effectivePathRule?.domainPath}. Click to set explicit rule on this path.`
                  : 'Policy for new requests: save full responses and replay automatically'
              }
              onClick={() => void handleAutoRecordToggle()}
            >
              {busy === 'auto' ? '…' : 'Record response'}
            </Button>
            {pendingCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-xs"
                style={{ width: DOMAIN_CAPTURE_BTN_WIDTH }}
                disabled={busy !== null}
                title="Fetch real responses for pending stubs under this path"
                onClick={() => void handleBulkCapture()}
              >
                {busy === 'capture' ? '…' : `Capture (${pendingCount})`}
              </Button>
            )}
            <div
              className="inline-flex h-7 shrink-0 overflow-hidden rounded-md border border-border"
              title={
                trafficMixed
                  ? 'Mocks in this folder use mixed replay and live settings'
                  : 'How existing mocks are served — does not change Record response policy for new requests'
              }
            >
              <Button
                type="button"
                variant={replayActive ? 'default' : 'ghost'}
                size="sm"
                className="h-7 rounded-none border-0 px-3 text-xs shadow-none"
                disabled={busy !== null || !canReplay}
                title={
                  canReplay
                    ? 'Replay saved responses (turns off live API for mocks in this folder)'
                    : 'Nothing to replay yet — capture a response first'
                }
                onClick={() => void handleTrafficModeChange('replay')}
              >
                {busy === 'mock' || busy === 'capture' ? '…' : 'Replay'}
              </Button>
              <Button
                type="button"
                variant={liveActive ? 'default' : 'ghost'}
                size="sm"
                className="h-7 rounded-none border-0 border-l border-border px-3 text-xs shadow-none"
                disabled={busy !== null}
                title="Always call the real API for mocks in this folder"
                onClick={() => void handleTrafficModeChange('live')}
              >
                {busy === 'live' ? '…' : 'Live'}
              </Button>
            </div>
          </div>
        )}
      </div>
      {open && <div className="border-t border-border/60 p-3 pt-2 space-y-3">{children}</div>}
    </div>
  )
}
