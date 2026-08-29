import { Badge } from '@/components/ui/badge'
import type { NetworkEvent, NetworkEventSource } from '@/types'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatNetworkHopLabel } from '@/lib/network-event-chains'
import { formatUsage, usageList } from '@/lib/network-usage'

const SOURCE_LABELS: Record<NetworkEventSource, string> = {
  'mock-hit': 'Mock',
  'mock-miss': 'Miss',
  upstream: 'Upstream',
  blocked: 'Blocked',
  error: 'Error',
}

interface TraceRow {
  event: NetworkEvent
  depth: number
  hasChildren: boolean
}

interface NetworkTraceViewProps {
  rows: TraceRow[]
  selectedId: string | null
  collapsedIds: Set<string>
  onToggleCollapse: (eventId: string) => void
  onSelect: (eventId: string) => void
}

export function NetworkTraceView({
  rows,
  selectedId,
  collapsedIds,
  onToggleCollapse,
  onSelect,
}: NetworkTraceViewProps) {
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No events to show in the trace tree.</p>
  }

  return (
    <div className="max-h-[36rem] overflow-auto divide-y divide-border font-mono text-xs">
      {rows.map(({ event, depth, hasChildren }) => {
        const collapsed = collapsedIds.has(event.id)
        const usages = usageList(event.usage)
        return (
          <div
            key={event.id}
            className={`flex items-start gap-1 px-2 py-1.5 hover:bg-accent/50 ${
              selectedId === event.id ? 'bg-accent' : ''
            }`}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            <button
              type="button"
              className="mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
              disabled={!hasChildren}
              aria-label={collapsed ? 'Expand' : 'Collapse'}
              onClick={() => hasChildren && onToggleCollapse(event.id)}
            >
              {hasChildren ? (
                collapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )
              ) : (
                <span className="w-3.5" />
              )}
            </button>
            <button
              type="button"
              className="flex-1 text-left min-w-0"
              onClick={() => onSelect(event.id)}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold w-12 shrink-0">
                  {event.kind === 'incident' ? 'ERR' : event.method}
                </span>
                <Badge variant="outline" className="text-[10px] font-sans">
                  {SOURCE_LABELS[event.source]}
                </Badge>
                {event.status != null && (
                  <span className="text-muted-foreground">{event.status}</span>
                )}
                {event.durationMs != null && (
                  <span className="text-muted-foreground">{event.durationMs}ms</span>
                )}
              </div>
              <div className="truncate text-muted-foreground mt-0.5">
                {formatNetworkHopLabel(event)}
              </div>
              {usages.length > 0 && (
                <div className="font-sans text-[10px] text-sky-700 dark:text-sky-400 mt-0.5">
                  used by: {usages.map(formatUsage).join(', ')}
                </div>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
