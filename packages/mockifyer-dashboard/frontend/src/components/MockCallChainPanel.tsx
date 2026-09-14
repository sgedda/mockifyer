import { GitBranch } from 'lucide-react'
import type { MockFile } from '@/types'
import {
  buildUniqueMockChainForest,
  countUniqueMockChainHops,
  formatShortCorrelationId,
  getChainRootRequestId,
  mockHopEndpointFingerprint,
  type MockUniqueChainNode,
} from '@/lib/mock-correlation-chains'

function UniqueChainNodeButton({
  node,
  selectedFilename,
  onSelectHop,
  depth,
}: {
  node: MockUniqueChainNode
  selectedFilename?: string | null
  onSelectHop: (mock: MockFile) => void
  depth: number
}) {
  const selected = node.hops.some((hop) => hop.filename === selectedFilename)

  return (
    <div className={depth > 0 ? 'ml-4 mt-1 border-l border-border/60 pl-2' : ''}>
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
            node.representative.requestId ? `request ${node.representative.requestId}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        }
        onClick={() => {
          const hop =
            node.hops.find((h) => h.filename === selectedFilename) ?? node.representative
          onSelectHop(hop)
        }}
      >
        {mockHopEndpointFingerprint(node.representative)}
        {node.callCount > 1 ? (
          <span className="ml-1 font-sans text-muted-foreground">×{node.callCount}</span>
        ) : null}
      </button>
      {node.children.map((child) => (
        <UniqueChainNodeButton
          key={child.fingerprint + child.representative.filename}
          node={child}
          selectedFilename={selectedFilename}
          onSelectHop={onSelectHop}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

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
      <div className="space-y-0.5">
        {forest.map((node) => (
          <UniqueChainNodeButton
            key={node.fingerprint + node.representative.filename}
            node={node}
            selectedFilename={selectedFilename}
            onSelectHop={onSelectHop}
            depth={0}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Nested hops from one user request. Repeated sibling calls are grouped (×N). Downstream mocks
        reference the caller as parent via Mockifyer correlation headers.
      </p>
    </div>
  )
}
