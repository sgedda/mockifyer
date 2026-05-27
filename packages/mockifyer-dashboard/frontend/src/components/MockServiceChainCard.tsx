import { ChevronDown, GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MockFile } from '@/types'
import type { MockServiceChain } from '@/lib/mock-correlation-chains'
import {
  chainHasRequestCorrelation,
  chainHasUpstreamReplayBlock,
  describeHopParentLink,
  formatMockHopLabel,
  formatMockHopSubtitle,
  formatShortCorrelationId,
  getChainRootRequestId,
  getMockHopTrafficMode,
  isEnrichedChainHop,
} from '@/lib/mock-correlation-chains'

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
  const hasReplayBlock = chain.hops.some((_, index) => chainHasUpstreamReplayBlock(chain.hops, index))
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

      <ol className="p-3 space-y-0">
        {chain.hops.map((hop, index) => {
          const isSelected = hop.filename === selectedFilename
          const isFirst = index === 0
          const isLast = index === chain.hops.length - 1
          const traffic = getMockHopTrafficMode(hop)
          const blocked = chainHasUpstreamReplayBlock(chain.hops, index)
          const hopRequestIdShort = formatShortCorrelationId(hop.requestId)
          const parentLink = describeHopParentLink(chain.hops, index)
          return (
            <li key={hop.filename} className="relative">
              {!isLast && (
                <span
                  className="absolute left-[1.15rem] top-9 bottom-0 w-px bg-border"
                  aria-hidden
                />
              )}
              <div className="flex gap-3 pb-3 last:pb-0">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    isFirst
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                  title={isFirst ? 'Chain entry (first service)' : `Hop ${index + 1}`}
                >
                  {index + 1}
                </div>
                <button
                  type="button"
                  className={`flex-1 min-w-0 text-left rounded-md border px-3 py-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:border-primary/40 hover:bg-accent/40'
                  }`}
                  onClick={() => onSelectHop(hop)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{formatMockHopLabel(hop)}</span>
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
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {formatMockHopSubtitle(hop)}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground font-mono">
                    {hopRequestIdShort ? (
                      <div title={hop.requestId ?? undefined}>
                        <span className="text-foreground/70">request</span> {hopRequestIdShort}
                      </div>
                    ) : (
                      <div className="text-foreground/50">request id not stored</div>
                    )}
                    {parentLink && (
                      <div className="flex items-center gap-1 text-emerald-200/80" title={hop.parentRequestId ?? undefined}>
                        <ChevronDown className="h-3 w-3 shrink-0 rotate-[-90deg]" aria-hidden />
                        {parentLink}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="px-3 pb-3 space-y-2">
        {hasReplayBlock && (
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            A hop on <strong className="font-medium">Replay</strong> returns its saved response and does not call
            the next service. To replay a downstream hop, set every upstream hop to <strong className="font-medium">Live</strong>{' '}
            (Domains view → Replay on the target path does this automatically).
          </p>
        )}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {hasEnrichedHops
            ? 'Entry hops such as GET /aggregate are included when they were recorded in the same run (URL + time), even if parent-request-id links start at a later service.'
            : chain.inferred
              ? 'Inferred from mocks recorded in the same run (time + URL order). Exact parent links appear after re-recording with dashboard proxy.'
              : 'Linked by Mockifyer hop ids — matches the Network tab call chain.'}
        </p>
      </div>
    </div>
  )
}
