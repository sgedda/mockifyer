import { ChevronDown, GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CopyableText } from '@/components/CopyableText'
import type { MockFile } from '@/types'
import {
  buildUniqueMockChainForest,
  chainHasRequestCorrelation,
  describeHopParentLink,
  formatMockHopLabel,
  formatMockHopSubtitle,
  hopPathLabelSourceFromMock,
  formatShortCorrelationId,
  getChainRootRequestId,
  getMockHopTrafficMode,
  isEnrichedChainHop,
  isMissingParentChainNode,
  type MockServiceChain,
  type MockUniqueChainNode,
} from '@/lib/mock-correlation-chains'
import { ColoredHopLabel } from '@/components/ColoredHopLabel'
import { ChainTreeToggle, CollapsibleChainTree, MockChainGroupedHopList } from '@/components/MockChainTree'
import { MockChainRoleReplayMenu } from '@/components/MockChainRoleReplayMenu'

function nodeHasReplay(node: MockUniqueChainNode): boolean {
  return node.hops.some((hop) => getMockHopTrafficMode(hop) === 'replay')
}

function forestHasUpstreamReplayBlock(nodes: MockUniqueChainNode[]): boolean {
  for (const node of nodes) {
    if (node.children.length > 0 && nodeHasReplay(node)) return true
    if (forestHasUpstreamReplayBlock(node.children)) return true
  }
  return false
}

function describeTreeParentLink(
  ancestors: MockUniqueChainNode[],
  hop: MockFile,
  chainHops: MockFile[]
): string | null {
  const hopIndex = chainHops.findIndex((candidate) => candidate.filename === hop.filename)
  if (hopIndex >= 0) {
    const fromIds = describeHopParentLink(chainHops, hopIndex)
    if (fromIds) return fromIds
  }
  const parent = ancestors[ancestors.length - 1]
  if (!parent) return null
  if (isMissingParentChainNode(parent)) {
    const short = formatShortCorrelationId(parent.representative.requestId)
    return short ? `Parent request id: ${short} (missing from catalog)` : 'Parent request id missing from catalog'
  }
  const parentHop = parent.representative
  const short = formatShortCorrelationId(parentHop.requestId)
  return `Parent: ${formatMockHopLabel(parentHop)}${short ? ` (${short})` : ''}`
}

export function MockServiceChainCard({
  chain,
  selectedFilename,
  onSelectHop,
  scenario,
  onReplayModeChange,
  replayActionsDisabled = false,
}: {
  chain: MockServiceChain
  selectedFilename?: string | null
  onSelectHop: (mock: MockFile) => void
  scenario?: string
  onReplayModeChange?: () => void
  replayActionsDisabled?: boolean
}) {
  const recordedAt = new Date(chain.latestModified).toLocaleString()
  const forest = buildUniqueMockChainForest(chain.hops)
  const hasReplayBlock = forestHasUpstreamReplayBlock(forest)
  const rootRequestId = getChainRootRequestId(chain.hops)
  const rootRequestIdShort = formatShortCorrelationId(rootRequestId)
  const hasCorrelation = chainHasRequestCorrelation(chain.hops)
  const hasEnrichedHops = (chain.enrichedHopFilenames?.length ?? 0) > 0

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
        <GitBranch className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden />
        <span className="text-sm font-medium">
          {chain.hops.length} service hop{chain.hops.length === 1 ? '' : 's'}
        </span>
        <Badge variant="outline" className="text-[10px]">
          one user request
        </Badge>
        {chain.inferred && (
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-100">
            {hasEnrichedHops ? 'includes entry hop' : 'inferred order'}
          </Badge>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">{recordedAt}</span>
        {scenario && onReplayModeChange && (
          <MockChainRoleReplayMenu
            scenario={scenario}
            chains={[chain]}
            onDone={onReplayModeChange}
            disabled={replayActionsDisabled}
            compact
          />
        )}
      </div>

      <div className="px-3 py-2 border-b border-border/40 bg-background/40 text-[11px] text-muted-foreground space-y-1">
        {rootRequestIdShort ? (
          <p>
            <span className="text-foreground/80">Root request id</span>{' '}
            <span className="font-mono text-foreground" title={rootRequestId ?? undefined}>
              {rootRequestIdShort}
            </span>
            {hasCorrelation ? (
              <span className="ml-1">— downstream hops reference this id as parent.</span>
            ) : (
              <span className="ml-1">— no parent links on downstream hops yet.</span>
            )}
          </p>
        ) : (
          <p>
            {chain.inferred
              ? 'No request ids on these mocks (inferred chain). Re-record with dashboard proxy to link parent → child.'
              : 'No root request id stored on the entry hop.'}
          </p>
        )}
        {forest.some(isMissingParentChainNode) && (
          <p className="text-amber-200/90">
            Entry hop for this parent id is not in the catalog (rewritten or not recorded). Children below still
            share that exact parent link.
          </p>
        )}
      </div>

      <div className="p-3">
        <CollapsibleChainTree
          forest={forest}
          selectedFilename={selectedFilename}
          renderNode={({ node, depth, expanded, hasChildren, nestedCount, ancestors, onToggle }) => {
            if (isMissingParentChainNode(node)) {
              const missingIdShort = formatShortCorrelationId(node.representative.requestId)
              return (
                <div className="flex gap-2 pb-2 last:pb-0">
                  <div className="flex flex-col items-center pt-2">
                    <ChainTreeToggle
                      hasChildren={hasChildren}
                      expanded={expanded}
                      nestedCount={nestedCount}
                      instanceCount={0}
                      onToggle={onToggle}
                    />
                  </div>
                  <div className="flex-1 min-w-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-amber-50">Missing entry hop</span>
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-100">
                        entry
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Parent request id{' '}
                      <span className="font-mono text-foreground/80" title={node.representative.requestId ?? undefined}>
                        {missingIdShort}
                      </span>{' '}
                      is not in this catalog — children below still link to it.
                    </p>
                  </div>
                </div>
              )
            }

            const hop = node.hops.find((h) => h.filename === selectedFilename) ?? node.representative
            const isSelected = node.hops.some((candidate) => candidate.filename === selectedFilename)
            const traffic = getMockHopTrafficMode(hop)
            const blocked = ancestors.some(nodeHasReplay)
            const hopRequestIdShort = formatShortCorrelationId(hop.requestId)
            const parentLink = describeTreeParentLink(ancestors, hop, chain.hops)
            const collapsedNested = !expanded && nestedCount > 0
            const isLeafHop = !hasChildren
            return (
              <div className="flex gap-2 pb-2 last:pb-0">
                <div className="flex flex-col items-center pt-2">
                  <ChainTreeToggle
                    hasChildren={hasChildren}
                    expanded={expanded}
                    nestedCount={nestedCount}
                    instanceCount={node.hops.length}
                    onToggle={onToggle}
                  />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex-1 min-w-0 text-left rounded-md border px-3 py-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:border-primary/40 hover:bg-accent/40'
                  }`}
                  title={
                    isLeafHop
                      ? 'Lowest-level hop — this call does not include nested requests'
                      : 'Parent hop — nested requests are included in this call'
                  }
                  onClick={() => {
                    if (hasChildren && !expanded) {
                      onToggle()
                      return
                    }
                    onSelectHop(hop)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      if (hasChildren && !expanded) {
                        onToggle()
                        return
                      }
                      onSelectHop(hop)
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">
                      <ColoredHopLabel source={hopPathLabelSourceFromMock(hop)} />
                    </span>
                    {node.callCount > 1 && (
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        title="Expand to each underlying call"
                        onClick={(event) => {
                          event.stopPropagation()
                          onToggle()
                        }}
                      >
                        ×{node.callCount}
                      </Badge>
                    )}
                    {collapsedNested && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                        title="Expand nested services"
                        onClick={(event) => {
                          event.stopPropagation()
                          onToggle()
                        }}
                      >
                        +{nestedCount} nested
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        traffic === 'live'
                          ? 'border-orange-500/40 text-orange-100'
                          : traffic === 'refresh'
                            ? 'border-cyan-500/40 text-cyan-100'
                            : traffic === 'pending'
                              ? 'border-amber-500/40 text-amber-100'
                              : 'border-sky-500/40 text-sky-100'
                      }`}
                      title={
                        traffic === 'live'
                          ? 'Always use live API'
                          : traffic === 'refresh'
                            ? 'Hits live API and updates the stored snapshot'
                            : traffic === 'pending'
                              ? 'Waiting for a captured response'
                              : 'Serves the saved mock body (does not call the next service)'
                      }
                    >
                      {traffic === 'live'
                        ? 'Live'
                        : traffic === 'refresh'
                          ? 'Refresh'
                          : traffic === 'pending'
                            ? 'Pending'
                            : 'Replay'}
                    </Badge>
                    {blocked && (
                      <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-100">
                        unreachable
                      </Badge>
                    )}
                    {isEnrichedChainHop(chain, hop) && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-500/40 text-amber-100"
                        title="Added from the same recording run (URL/time); may lack parent-request-id link to the next hop"
                      >
                        entry hop
                      </Badge>
                    )}
                    {depth === 0 && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-100">
                        entry
                      </Badge>
                    )}
                    {isLeafHop && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-400/70 bg-amber-500/20 text-amber-50"
                        title="Lowest-level hop. Parent hops include nested request time and payload."
                      >
                        leaf
                      </Badge>
                    )}
                  </div>
                  <CopyableText
                    value={formatMockHopSubtitle(hop)}
                    copyLabel="Copy request URL"
                    className="mt-0.5"
                    textClassName="text-[11px] text-muted-foreground"
                  />
                  <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground font-mono">
                    {hopRequestIdShort ? (
                      <div title={hop.requestId ?? undefined}>
                        <span className="text-foreground/70">request</span> {hopRequestIdShort}
                      </div>
                    ) : (
                      <div className="text-foreground/50">request id not stored</div>
                    )}
                    {parentLink && (
                      <div
                        className="flex items-center gap-1 text-emerald-200/80"
                        title={hop.parentRequestId ?? undefined}
                      >
                        <ChevronDown className="h-3 w-3 shrink-0 rotate-[-90deg]" aria-hidden />
                        {parentLink}
                      </div>
                    )}
                  </div>
                  {expanded && (
                    <MockChainGroupedHopList
                      hops={node.hops}
                      selectedFilename={selectedFilename}
                      onSelectHop={onSelectHop}
                    />
                  )}
                </div>
              </div>
            )
          }}
        />
      </div>

      <div className="px-3 pb-3 space-y-2">
        {hasReplayBlock && (
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            A hop on <strong className="font-medium">Replay</strong> (use saved mock) returns its stored response
            and does not call the next service. Always refresh from live / Live API still hit upstream.
            To reach a downstream hop, set every upstream hop to{' '}
            <strong className="font-medium">Live</strong> or <strong className="font-medium">Always refresh from live</strong>
            {' '}(<strong className="font-medium">Use mock → All source hops</strong> does this automatically).
          </p>
        )}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Nested hops start collapsed. Expand a hop to see calls it triggered, or expand ×N to each
          underlying request. Lowest-level hops show a <span className="text-amber-200/90">leaf</span> badge
          {' '}— parent hops include nested requests in their time and size. Linked only by Mockifyer
          hop ids (this hop called that hop).
        </p>
      </div>
    </div>
  )
}
