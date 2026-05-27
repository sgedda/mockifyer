import { ChevronRight, GitBranch } from 'lucide-react'
import type { MockFile } from '@/types'
import {
  describeHopParentLink,
  formatMockHopLabel,
  formatShortCorrelationId,
  getChainRootRequestId,
} from '@/lib/mock-correlation-chains'

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

  const rootId = formatShortCorrelationId(getChainRootRequestId(chain))

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="text-xs font-medium flex items-center gap-1.5 flex-wrap">
        <GitBranch className="h-3.5 w-3.5" />
        {title} ({chain.length} hops)
        {rootId && (
          <span className="font-mono font-normal text-muted-foreground" title={getChainRootRequestId(chain) ?? undefined}>
            root {rootId}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {chain.map((hop, index) => (
          <span key={hop.filename} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            <button
              type="button"
              className={`text-left rounded px-2 py-1 text-[11px] font-mono border transition-colors max-w-[14rem] truncate ${
                hop.filename === selectedFilename
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent hover:border-border hover:bg-background'
              }`}
              title={
                [
                  hop.endpoint ?? hop.filename,
                  hop.requestId ? `request ${hop.requestId}` : null,
                  describeHopParentLink(chain, index),
                ]
                  .filter(Boolean)
                  .join(' · ')
              }
              onClick={() => onSelectHop(hop)}
            >
              {formatMockHopLabel(hop)}
            </button>
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Recorded hops from the same user request. Each service assigns its own id; downstream mocks reference the
        caller as parent (via Mockifyer correlation headers).
      </p>
    </div>
  )
}
