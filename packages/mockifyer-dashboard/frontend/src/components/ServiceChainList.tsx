import { Link } from 'react-router-dom'
import { GitFork } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { MockServiceChainCard } from '@/components/MockServiceChainCard'
import { hopsPath } from '@/lib/dashboard-urls'
import type { MockServiceChain } from '@/lib/mock-correlation-chains'
import type { MockFile } from '@/types'

const STATS_PREVIEW_LIMIT = 6

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

interface ServiceChainListProps {
  chains: MockServiceChain[]
  onSelectHop: (mock: MockFile) => void
  selectedFilename?: string | null
  loading?: boolean
  searchQuery?: string
  scenario?: string
  /** When set, only the newest N chains are shown (statistics preview). */
  limit?: number
  hasOrphanParentIds?: boolean
}

export function ServiceChainList({
  chains,
  onSelectHop,
  selectedFilename = null,
  loading = false,
  searchQuery = '',
  scenario,
  limit,
  hasOrphanParentIds = false,
}: ServiceChainListProps) {
  const previewLimit = limit ?? STATS_PREVIEW_LIMIT
  const isPreview = limit != null
  const shown = isPreview ? chains.slice(0, previewLimit) : chains
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
      {shown.map((chain) => (
        <MockServiceChainCard
          key={chain.id}
          chain={chain}
          selectedFilename={selectedFilename}
          onSelectHop={onSelectHop}
        />
      ))}
      {isPreview && chains.length > previewLimit && (
        <p className="text-xs text-muted-foreground">
          Showing {previewLimit} newest chains.{' '}
          <Link to={hopsPath({ scenario })} className="text-primary hover:underline">
            Open Hops for the full list →
          </Link>
        </p>
      )}
    </div>
  )
}
