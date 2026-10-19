import type { TimingBar, TimingWindow } from '@/lib/network-event-chains'
import { formatNetworkHopLabel } from '@/lib/network-event-chains'
import { formatUsage, usageList } from '@/lib/network-usage'

function sourceBarClass(source: string): string {
  switch (source) {
    case 'mock-hit':
      return 'bg-emerald-500/80'
    case 'upstream':
      return 'bg-sky-500/80'
    case 'error':
    case 'blocked':
      return 'bg-destructive/80'
    case 'mock-miss':
      return 'bg-amber-500/80'
    default:
      return 'bg-primary/70'
  }
}

function formatAxisMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 1000)}s`
}

interface NetworkTimingChartProps {
  window: TimingWindow
  selectedId: string | null
  onSelect: (eventId: string) => void
  /** Indent row labels by correlation depth (waterfall). */
  showDepthIndent?: boolean
  /** Optional label above the chart. */
  emptyMessage?: string
}

/**
 * Shared absolute-time bar chart used by Waterfall (tree-ordered) and Gantt (group-ordered).
 */
export function NetworkTimingChart({
  window: timing,
  selectedId,
  onSelect,
  showDepthIndent = false,
  emptyMessage = 'No timing data.',
}: NetworkTimingChartProps) {
  if (timing.bars.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * timing.spanMs)

  return (
    <div className="max-h-[36rem] overflow-auto">
      <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-1.5 flex gap-2 text-[10px] text-muted-foreground font-mono">
        <div className="w-48 shrink-0 sm:w-64" />
        <div className="flex-1 relative h-4">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2"
              style={{ left: `${(t / timing.spanMs) * 100}%` }}
            >
              {formatAxisMs(t)}
            </span>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {timing.bars.map((bar) => (
          <TimingRow
            key={bar.event.id}
            bar={bar}
            spanMs={timing.spanMs}
            selected={selectedId === bar.event.id}
            showDepthIndent={showDepthIndent}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function TimingRow({
  bar,
  spanMs,
  selected,
  showDepthIndent,
  onSelect,
}: {
  bar: TimingBar
  spanMs: number
  selected: boolean
  showDepthIndent: boolean
  onSelect: (id: string) => void
}) {
  const left = (bar.startMs / spanMs) * 100
  const width = Math.max((bar.durationMs / spanMs) * 100, 0.4)
  const usages = usageList(bar.event.usage)
  const pad = showDepthIndent ? Math.min(bar.depth, 6) * 10 : 0

  return (
    <button
      type="button"
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/40 ${
        selected ? 'bg-accent' : ''
      }`}
      onClick={() => onSelect(bar.event.id)}
    >
      <div className="w-48 sm:w-64 shrink-0 min-w-0" style={{ paddingLeft: pad }}>
        <div className="font-mono text-[11px] truncate font-medium">
          {bar.event.method}{' '}
          <span className="text-muted-foreground font-normal">
            {bar.event.path || bar.event.url}
          </span>
        </div>
        {usages.length > 0 && (
          <div className="text-[10px] text-sky-700 dark:text-sky-400 truncate">
            {usages.map(formatUsage).join(', ')}
          </div>
        )}
      </div>
      <div className="flex-1 relative h-6 rounded bg-muted/40 overflow-hidden">
        <div
          className={`absolute top-1 bottom-1 rounded-sm ${sourceBarClass(bar.event.source)} ${
            selected ? 'ring-1 ring-primary' : ''
          }`}
          style={{ left: `${left}%`, width: `${width}%` }}
          title={`${formatNetworkHopLabel(bar.event)} · ${bar.durationMs}ms`}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
        {bar.event.durationMs != null ? `${bar.event.durationMs}ms` : '—'}
      </span>
    </button>
  )
}
