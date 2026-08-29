import { useMemo } from 'react'
import type { NetworkEvent } from '@/types'
import {
  buildTimingWindow,
  type JourneyStep,
  type TimingWindow,
} from '@/lib/network-event-chains'
import { NetworkTimingChart } from './NetworkTimingChart'
import { formatNetworkHopLabel } from '@/lib/network-event-chains'
import { formatUsage, usageList } from '@/lib/network-usage'

interface NetworkWaterfallViewProps {
  events: NetworkEvent[]
  depthById: Map<string, number>
  selectedId: string | null
  onSelect: (eventId: string) => void
}

/** One row per hop in time order; bars aligned to absolute start (Chrome-style waterfall). */
export function NetworkWaterfallView({
  events,
  depthById,
  selectedId,
  onSelect,
}: NetworkWaterfallViewProps) {
  const window = useMemo(() => buildTimingWindow(events, depthById), [events, depthById])
  return (
    <NetworkTimingChart
      window={window}
      selectedId={selectedId}
      onSelect={onSelect}
      showDepthIndent
      emptyMessage="No events for waterfall."
    />
  )
}

interface NetworkGanttViewProps {
  steps: JourneyStep[]
  selectedId: string | null
  onSelect: (eventId: string) => void
}

/**
 * Gantt: same time axis, rows grouped by journey step (screen / prefetch).
 * Shared hops can appear in multiple groups.
 */
export function NetworkGanttView({ steps, selectedId, onSelect }: NetworkGanttViewProps) {
  const allEvents = useMemo(() => {
    const byId = new Map<string, NetworkEvent>()
    for (const step of steps) {
      for (const ev of step.events) byId.set(ev.id, ev)
    }
    return [...byId.values()]
  }, [steps])

  const globalWindow = useMemo(() => buildTimingWindow(allEvents), [allEvents])

  if (steps.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No events for gantt.</p>
  }

  return (
    <div className="max-h-[36rem] overflow-auto space-y-4 p-2">
      {steps.map((step) => {
        const ids = new Set(step.events.map((e) => e.id))
        const groupWindow: TimingWindow = {
          ...globalWindow,
          bars: globalWindow.bars.filter((b) => ids.has(b.event.id)),
        }
        return (
          <div key={step.key} className="rounded-md border border-border overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/50 text-xs font-medium flex items-center justify-between">
              <span>{step.label}</span>
              <span className="text-muted-foreground font-normal">
                {step.events.length} hop{step.events.length === 1 ? '' : 's'}
              </span>
            </div>
            <NetworkTimingChart
              window={groupWindow}
              selectedId={selectedId}
              onSelect={onSelect}
              emptyMessage="No hops in this step."
            />
          </div>
        )
      })}
    </div>
  )
}

interface NetworkJourneyViewProps {
  steps: JourneyStep[]
  selectedId: string | null
  onSelect: (eventId: string) => void
}

/** Horizontal journey strip: screens in order, hops listed under each. */
export function NetworkJourneyView({ steps, selectedId, onSelect }: NetworkJourneyViewProps) {
  if (steps.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No journey steps yet.</p>
  }

  return (
    <div className="max-h-[36rem] overflow-auto p-3 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2 shrink-0">
            {i > 0 && (
              <div className="w-6 h-px bg-border shrink-0" aria-hidden />
            )}
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 min-w-[10rem] max-w-[16rem]">
              <div className="text-xs font-semibold truncate">{step.label}</div>
              <div className="text-[10px] text-muted-foreground">
                {step.events.length} hop{step.events.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <div key={step.key} className="rounded-md border border-border overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/40 text-xs font-medium border-b border-border">
              {step.label}
            </div>
            <ul className="divide-y divide-border max-h-64 overflow-auto">
              {step.events.map((ev) => {
                const usages = usageList(ev.usage)
                return (
                  <li key={`${step.key}-${ev.id}`}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 hover:bg-accent/50 ${
                        selectedId === ev.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => onSelect(ev.id)}
                    >
                      <div className="font-mono text-[11px] truncate">
                        {formatNetworkHopLabel(ev)}
                      </div>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {ev.durationMs != null && <span>{ev.durationMs}ms</span>}
                        {ev.status != null && <span>{ev.status}</span>}
                      </div>
                      {usages.length > 0 && (
                        <div className="text-[10px] text-sky-700 dark:text-sky-400 mt-0.5 truncate">
                          {usages.map(formatUsage).join(', ')}
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
