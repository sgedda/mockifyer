import { GitBranch } from 'lucide-react'
import type { MockFile } from '@/types'
import {
  buildUniqueMockChainForest,
  countUniqueMockChainHops,
  formatShortCorrelationId,
  getChainRootRequestId,
  mockHopEndpointFingerprint,
} from '@/lib/mock-correlation-chains'
import { ChainTreeToggle, CollapsibleChainTree, MockChainGroupedHopList } from '@/components/MockChainTree'

export function MockCallChainPanel({
  chain,
  selectedFilename,
  onSelectHop,
  title = 'Service chain',
}: {
  chain: MockFile[]
  selectedFilename?: string | null
  onSelectHop: (mock: MockFile) => void
  title?: string
}) {
  if (chain.length < 2) return null

  const forest = buildUniqueMockChainForest(chain)
  const uniqueCount = countUniqueMockChainHops(chain)
  const rootId = formatShortCorrelationId(getChainRootRequestId(chain))

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="text-xs font-medium flex items-center gap-1.5 flex-wrap">
        <GitBranch className="h-3.5 w-3.5" />
        {title} ({chain.length} hops
        {uniqueCount < chain.length ? `, ${uniqueCount} unique` : ''})
        {rootId && (
          <span className="font-mono font-normal text-muted-foreground" title={getChainRootRequestId(chain) ?? undefined}>
            root {rootId}
          </span>
        )}
      </div>
      <CollapsibleChainTree
        forest={forest}
        selectedFilename={selectedFilename}
        renderNode={({ node, depth, expanded, hasChildren, nestedCount, onToggle }) => {
          const selected = node.hops.some((hop) => hop.filename === selectedFilename)
          return (
            <div className="flex items-center gap-0.5 min-w-0">
              <ChainTreeToggle
                hasChildren={hasChildren}
                expanded={expanded}
                nestedCount={nestedCount}
                instanceCount={node.hops.length}
                onToggle={onToggle}
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className={`text-left rounded px-2 py-1 text-[11px] font-mono border transition-colors max-w-full truncate ${
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent hover:border-border hover:bg-background'
                  }`}
                  title={
                    [
                      mockHopEndpointFingerprint(node.representative),
                      node.callCount > 1 ? `${node.callCount} identical calls` : null,
                      depth > 0 ? `nested level ${depth}` : 'entry',
                      !expanded && nestedCount > 0 ? `${nestedCount} nested hops` : null,
                      node.representative.requestId ? `request ${node.representative.requestId}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                  onClick={() => {
                    if (hasChildren && !expanded) {
                      onToggle()
                      return
                    }
                    const hop =
                      node.hops.find((h) => h.filename === selectedFilename) ?? node.representative
                    onSelectHop(hop)
                  }}
                >
                  {mockHopEndpointFingerprint(node.representative)}
                  {node.callCount > 1 ? (
                    <span className="ml-1 font-sans text-muted-foreground">×{node.callCount}</span>
                  ) : null}
                  {!expanded && nestedCount > 0 ? (
                    <span className="ml-1 font-sans text-muted-foreground">+{nestedCount} nested</span>
                  ) : null}
                </button>
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
      <p className="text-[11px] text-muted-foreground">
        Nested hops from one user request. Repeated sibling calls are grouped (×N) — expand to each
        underlying call. Downstream mocks start collapsed under their caller.
      </p>
    </div>
  )
}
