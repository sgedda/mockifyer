import { Link } from 'react-router-dom'
import { GitFork } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MockServiceChainCard } from '@/components/MockServiceChainCard'
import { hopsFocusPath, hopsPath } from '@/lib/dashboard-urls'
import { ColoredChainPathLabel } from '@/components/ColoredHopLabel'
import { formatChainFirstLastLabel, type MockServiceChain } from '@/lib/mock-correlation-chains'
import { countServiceChainHops } from '@/lib/use-mock-service-chains'
import type { MockFile } from '@/types'

export function hopsSummaryLabel(chainCount: number, hopCount: number): string {
  const chains = `${chainCount} multi-hop${chainCount === 1 ? '' : 's'}`
  const hops = `${hopCount} hop${hopCount === 1 ? '' : 's'}`
  return `${chains} · ${hops}`
}

export function HopsNavCard({
  chainCount,
  hopCount,
  scenario,
}: {
  chainCount: number
  hopCount: number
  scenario?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Link
          to={hopsPath({ scenario })}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <GitFork className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <div className="text-sm font-medium truncate">
              Service hops{' '}
              <span className="text-xs font-normal text-muted-foreground">
                ({hopsSummaryLabel(chainCount, hopCount)})
              </span>
            </div>
          </div>
          <div className="text-xs text-primary shrink-0">Open Hops →</div>
        </Link>
      </CardContent>
    </Card>
  )
}

/** Compact chain list for Statistics; rows open Hops focused on that chain. */
export function ServiceHopSummaryCard({
  chains,
  loading = false,
  scenario,
}: {
  chains: MockServiceChain[]
  loading?: boolean
  scenario?: string
}) {
  const hopCount = countServiceChainHops(chains)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitFork className="h-4 w-4 text-primary" />
          Service hops
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          {loading && chains.length === 0
            ? 'Loading chains…'
            : hopsSummaryLabel(chains.length, hopCount)}
        </p>
      </CardHeader>
      <CardContent>
        {loading && chains.length === 0 ? (
          <div className="text-sm text-muted-foreground">Loading hops...</div>
        ) : chains.length === 0 ? (
          <div className="text-sm text-muted-foreground">No linked service chains in this scenario yet.</div>
        ) : (
          <div className="space-y-0.5">
            {chains.map((chain) => {
              const focusFile = chain.hops[chain.hops.length - 1]?.filename ?? chain.hops[0]?.filename
              const label = formatChainFirstLastLabel(chain)
              if (!focusFile) {
                return (
                  <div key={chain.id} className="flex items-center justify-between gap-2 px-2 py-1 -mx-2">
                    <span className="font-mono text-xs truncate" title={label}>
                      <ColoredChainPathLabel chain={chain} />
                    </span>
                  </div>
                )
              }
              return (
                <Link
                  key={chain.id}
                  to={hopsFocusPath({ scenario, filename: focusFile })}
                  className="flex items-center justify-between gap-2 px-2 py-1 -mx-2 rounded-md hover:bg-accent/50"
                >
                  <span className="font-mono text-xs truncate" title={label}>
                    <ColoredChainPathLabel chain={chain} />
                  </span>
                  <span className="text-zinc-500 shrink-0 tabular-nums text-xs">
                    {chain.hops.length} hop{chain.hops.length === 1 ? '' : 's'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ServiceChainListProps {
  chains: MockServiceChain[]
  onSelectHop: (mock: MockFile) => void
  selectedFilename?: string | null
  loading?: boolean
  searchQuery?: string
  hasOrphanParentIds?: boolean
}

export function ServiceChainList({
  chains,
  onSelectHop,
  selectedFilename = null,
  loading = false,
  searchQuery = '',
  hasOrphanParentIds = false,
}: ServiceChainListProps) {
  const q = searchQuery.trim()

  if (loading && chains.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading hops...</div>
        </CardContent>
      </Card>
    )
  }

  if (chains.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 space-y-2 text-center text-muted-foreground text-sm">
          <p>
            {q
              ? 'No service chain includes a hop matching this search.'
              : 'No linked service chains in this scenario yet.'}
          </p>
          {!q && (
            <p>
              {hasOrphanParentIds ? (
                <>
                  Some mocks have a parent request id but are not linked into a full chain yet. Re-run{' '}
                  <span className="font-mono text-foreground">dev:proxy:record</span> so each hop saves
                  correlation ids (same as the Network tab).
                </>
              ) : (
                <>
                  Record via dashboard proxy (<span className="font-mono">dev:proxy:record</span>) and
                  trigger a multi-service flow — each hop should appear here in order, like the Network
                  tab.
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative space-y-4">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/60 pt-8 text-sm text-muted-foreground backdrop-blur-[1px]">
          Refreshing hops…
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Each card is one user request across services. Nested hops start collapsed under the caller;
        expand a hop to see the next level.
      </p>
      {chains.map((chain) => {
        const focused = Boolean(
          selectedFilename && chain.hops.some((hop) => hop.filename === selectedFilename)
        )
        return (
          <div
            key={chain.id}
            ref={focused ? (node) => node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) : undefined}
          >
            <MockServiceChainCard
              chain={chain}
              selectedFilename={selectedFilename}
              onSelectHop={onSelectHop}
            />
          </div>
        )
      })}
    </div>
  )
}
