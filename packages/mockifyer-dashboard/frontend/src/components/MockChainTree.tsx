import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { MockFile } from '@/types'
import {
  countNestedMockChainCalls,
  formatMockHopSubtitle,
  formatShortCorrelationId,
  mockChainNodeCanExpand,
  uniqueChainNodeContainsFilename,
  type MockUniqueChainNode,
} from '@/lib/mock-correlation-chains'

export interface MockChainTreeNodeRenderArgs {
  node: MockUniqueChainNode
  depth: number
  expanded: boolean
  hasChildren: boolean
  nestedCount: number
  ancestors: MockUniqueChainNode[]
  onToggle: () => void
}

function chainNodeKey(node: MockUniqueChainNode): string {
  return `${node.fingerprint}:${node.representative.filename}`
}

function CollapsibleChainTreeNode({
  node,
  depth,
  ancestors,
  selectedFilename,
  defaultCollapse,
  renderNode,
}: {
  node: MockUniqueChainNode
  depth: number
  ancestors: MockUniqueChainNode[]
  selectedFilename?: string | null
  defaultCollapse: boolean
  renderNode: (args: MockChainTreeNodeRenderArgs) => ReactNode
}) {
  const hasChildren = mockChainNodeCanExpand(node)
  const selectedHere = node.hops.some((hop) => hop.filename === selectedFilename)
  const selectedBelow =
    !selectedHere && uniqueChainNodeContainsFilename(node, selectedFilename)
  const implicitExpanded = defaultCollapse
    ? selectedBelow || (selectedHere && node.hops.length > 1)
    : true
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null)
  const expanded = hasChildren && (userExpanded ?? implicitExpanded)
  const nestedCount = countNestedMockChainCalls(node)

  return (
    <div className={depth > 0 ? 'ml-4 mt-1 border-l border-border/60 pl-2' : ''}>
      {renderNode({
        node,
        depth,
        expanded,
        hasChildren,
        nestedCount,
        ancestors,
        onToggle: () => setUserExpanded(!(userExpanded ?? implicitExpanded)),
      })}
      {hasChildren &&
        expanded &&
        node.children.map((child) => (
          <CollapsibleChainTreeNode
            key={chainNodeKey(child)}
            node={child}
            depth={depth + 1}
            ancestors={[...ancestors, node]}
            selectedFilename={selectedFilename}
            defaultCollapse={defaultCollapse}
            renderNode={renderNode}
          />
        ))}
    </div>
  )
}

/** Nested service-chain tree. Nested levels start collapsed unless a descendant is selected. */
export function CollapsibleChainTree({
  forest,
  selectedFilename,
  renderNode,
  defaultCollapse = true,
}: {
  forest: MockUniqueChainNode[]
  selectedFilename?: string | null
  renderNode: (args: MockChainTreeNodeRenderArgs) => ReactNode
  defaultCollapse?: boolean
}) {
  return (
    <div className="space-y-0.5">
      {forest.map((node) => (
        <CollapsibleChainTreeNode
          key={chainNodeKey(node)}
          node={node}
          depth={0}
          ancestors={[]}
          selectedFilename={selectedFilename}
          defaultCollapse={defaultCollapse}
          renderNode={renderNode}
        />
      ))}
    </div>
  )
}

export function ChainTreeToggle({
  hasChildren,
  expanded,
  nestedCount,
  instanceCount = 0,
  onToggle,
}: {
  hasChildren: boolean
  expanded: boolean
  nestedCount: number
  instanceCount?: number
  onToggle: () => void
}) {
  if (!hasChildren) {
    return <span className="inline-block w-5 shrink-0" aria-hidden />
  }
  const collapsedHint =
    instanceCount > 1 && nestedCount === 0
      ? `${instanceCount} calls · expand`
      : nestedCount > 0
        ? `${nestedCount} nested · expand`
        : 'Expand'
  return (
    <button
      type="button"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={expanded ? 'Collapse nested hops' : 'Expand nested hops'}
      title={expanded ? 'Collapse nested hops' : collapsedHint}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  )
}

/** Individual calls hidden behind a grouped ×N hop. */
export function MockChainGroupedHopList({
  hops,
  selectedFilename,
  onSelectHop,
}: {
  hops: MockFile[]
  selectedFilename?: string | null
  onSelectHop: (mock: MockFile) => void
}) {
  if (hops.length < 2) return null
  return (
    <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
      {hops.map((hop, index) => {
        const selected = hop.filename === selectedFilename
        const requestShort = formatShortCorrelationId(hop.requestId)
        return (
          <li key={hop.filename}>
            <button
              type="button"
              className={`flex w-full min-w-0 flex-col items-start rounded-md border px-2 py-1.5 text-left transition-colors ${
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent hover:border-border hover:bg-background/80'
              }`}
              title="Open this call"
              onClick={(event) => {
                event.stopPropagation()
                onSelectHop(hop)
              }}
            >
              <span className="flex w-full items-center gap-2 font-mono text-[11px] text-foreground">
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {index + 1}/{hops.length}
                </span>
                <span className="min-w-0 truncate">{formatMockHopSubtitle(hop)}</span>
              </span>
              {requestShort && (
                <span className="pl-7 font-mono text-[10px] text-muted-foreground" title={hop.requestId ?? undefined}>
                  request {requestShort}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
