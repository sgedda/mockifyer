import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  countNestedMockChainCalls,
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
  const hasChildren = node.children.length > 0
  const selectedHere = node.hops.some((hop) => hop.filename === selectedFilename)
  const selectedBelow =
    !selectedHere && uniqueChainNodeContainsFilename(node, selectedFilename)
  const implicitExpanded = defaultCollapse ? selectedBelow : true
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
  onToggle,
}: {
  hasChildren: boolean
  expanded: boolean
  nestedCount: number
  onToggle: () => void
}) {
  if (!hasChildren) {
    return <span className="inline-block w-4 shrink-0" aria-hidden />
  }
  return (
    <button
      type="button"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={expanded ? 'Collapse nested hops' : 'Expand nested hops'}
      title={expanded ? 'Collapse nested hops' : `${nestedCount} nested · expand`}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  )
}
