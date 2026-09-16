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
  formatShortCorrelationId,
  getChainRootRequestId,
  getMockHopTrafficMode,
  isEnrichedChainHop,
  mockHopEndpointFingerprint,
  type MockServiceChain,
  type MockUniqueChainNode,
} from '@/lib/mock-correlation-chains'
import { ChainTreeToggle, CollapsibleChainTree, MockChainGroupedHopList } from '@/components/MockChainTree'

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
  const parent = ancestors[ancestors.length - 1]
  if (parent) {
    const short = formatShortCorrelationId(parent.representative.requestId)
    return `Parent: ${mockHopEndpointFingerprint(parent.representative)}${short ? ` (${short})` : ''}`
  }
  const hopIndex = chainHops.findIndex((candidate) => candidate.filename === hop.filename)
  return hopIndex >= 0 ? describeHopParentLink(chainHops, hopIndex) : null
}

export function MockServiceChainCard({
  chain,
  selectedFilename,
  onSelectHop,
}: {
  chain: MockServiceChain
  selectedFilename?: string | null
  onSelectHop: (mock: MockFile) => void
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
      </div>

      <div className="p-3">
        <CollapsibleChainTree
          forest={forest}
          selectedFilename={selectedFilename}
          renderNode={({ node, depth, expanded, hasChildren, nestedCount, ancestors, onToggle }) => {
            const hop = node.hops.find((h) => h.filename === selectedFilename) ?? node.representative
            const isSelected = node.hops.some((candidate) => candidate.filename === selectedFilename)
            const traffic = getMockHopTrafficMode(hop)
            const blocked = ancestors.some(nodeHasReplay)
            const hopRequestIdShort = formatShortCorrelationId(hop.requestId)
            const parentLink = describeTreeParentLink(ancestors, hop, chain.hops)
            const collapsedNested = !expanded && nestedCount > 0
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
                    <span className="font-mono text-sm text-foreground">{formatMockHopLabel(hop)}</span>
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
                          : traffic === 'pending'
                            ? 'border-amber-500/40 text-amber-100'
                            : 'border-sky-500/40 text-sky-100'
                      }`}
                    >
                      {traffic === 'live' ? 'Live' : traffic === 'pending' ? 'Pending' : 'Replay'}
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
            A hop on <strong className="font-medium">Replay</strong> returns its saved response and does not call
            the next service. To replay a downstream hop, set every upstream hop to <strong className="font-medium">Live</strong>{' '}
            (Domains view → Replay on the target path does this automatically).
          </p>
        )}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Nested hops start collapsed. Expand a hop to see calls it triggered, or expand ×N to each
          underlying request
          {hasEnrichedHops
            ? '. Entry hops such as GET /aggregate are included when they were recorded in the same run (URL + time), even if parent-request-id links start at a later service.'
            : chain.inferred
              ? '. Inferred from mocks recorded in the same run (time + URL order). Exact parent links appear after re-recording with dashboard proxy.'
              : '. Linked by Mockifyer hop ids — matches the Network tab call chain.'}
        </p>
      </div>
    </div>
  )
}
