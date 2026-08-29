import type { NetworkEvent } from '@/types'
import { usageList } from '@/lib/network-usage'

export interface NetworkEventChainMaps {
  byRequestId: Map<string, NetworkEvent>
  childrenByParent: Map<string, NetworkEvent[]>
}

export function buildNetworkEventChainMaps(events: NetworkEvent[]): NetworkEventChainMaps {
  const byRequestId = new Map<string, NetworkEvent>()
  const childrenByParent = new Map<string, NetworkEvent[]>()

  for (const event of events) {
    if (event.requestId) {
      byRequestId.set(event.requestId, event)
    }
    if (event.parentRequestId) {
      const siblings = childrenByParent.get(event.parentRequestId) ?? []
      siblings.push(event)
      childrenByParent.set(event.parentRequestId, siblings)
    }
  }

  return { byRequestId, childrenByParent }
}

/** Walk parent links oldest-first (root → … → event). */
export function getNetworkEventChain(
  event: NetworkEvent,
  byRequestId: Map<string, NetworkEvent>
): NetworkEvent[] {
  const chain: NetworkEvent[] = [event]
  const seen = new Set<string>([event.id])
  let current = event

  while (current.parentRequestId) {
    const parent = byRequestId.get(current.parentRequestId)
    if (!parent || seen.has(parent.id)) {
      break
    }
    chain.unshift(parent)
    seen.add(parent.id)
    current = parent
  }

  return chain
}

export function formatNetworkHopLabel(event: NetworkEvent): string {
  const path = event.path || event.url
  return `${event.method} ${path}`
}

export function isChainRoot(event: NetworkEvent): boolean {
  return !event.parentRequestId
}

export function hasChainChildren(event: NetworkEvent, childrenByParent: Map<string, NetworkEvent[]>): boolean {
  if (!event.requestId) return false
  return (childrenByParent.get(event.requestId)?.length ?? 0) > 0
}

export function chainDepth(event: NetworkEvent, byRequestId: Map<string, NetworkEvent>): number {
  return getNetworkEventChain(event, byRequestId).length - 1
}

export interface TraceTreeNode {
  event: NetworkEvent
  children: TraceTreeNode[]
}

/**
 * Build a forest of request chains. Orphans whose parent is missing become roots.
 * Children are ordered by timestamp ascending.
 */
export function buildTraceForest(
  events: NetworkEvent[],
  maps: NetworkEventChainMaps
): TraceTreeNode[] {
  const nodeById = new Map<string, TraceTreeNode>()
  for (const event of events) {
    nodeById.set(event.id, { event, children: [] })
  }

  const roots: TraceTreeNode[] = []
  const attached = new Set<string>()

  for (const event of events) {
    const node = nodeById.get(event.id)!
    const parent =
      event.parentRequestId != null ? maps.byRequestId.get(event.parentRequestId) : undefined
    if (parent && nodeById.has(parent.id) && parent.id !== event.id) {
      nodeById.get(parent.id)!.children.push(node)
      attached.add(event.id)
    }
  }

  for (const event of events) {
    if (!attached.has(event.id)) {
      roots.push(nodeById.get(event.id)!)
    }
  }

  const sortRecursive = (nodes: TraceTreeNode[]) => {
    nodes.sort(
      (a, b) => new Date(a.event.timestamp).getTime() - new Date(b.event.timestamp).getTime()
    )
    for (const n of nodes) sortRecursive(n.children)
  }
  sortRecursive(roots)
  return roots
}

/** Flatten forest in DFS order (visible rows when all expanded). */
export function flattenTraceForest(
  forest: TraceTreeNode[],
  collapsedIds: Set<string>
): Array<{ event: NetworkEvent; depth: number; hasChildren: boolean }> {
  const rows: Array<{ event: NetworkEvent; depth: number; hasChildren: boolean }> = []

  const walk = (nodes: TraceTreeNode[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0
      rows.push({ event: node.event, depth, hasChildren })
      if (hasChildren && !collapsedIds.has(node.event.id)) {
        walk(node.children, depth + 1)
      }
    }
  }
  walk(forest, 0)
  return rows
}

export interface TimingBar {
  event: NetworkEvent
  /** ms from window start */
  startMs: number
  endMs: number
  durationMs: number
  depth: number
}

export interface TimingWindow {
  t0: number
  t1: number
  spanMs: number
  bars: TimingBar[]
}

const FALLBACK_DURATION_MS = 8

function eventStartMs(event: NetworkEvent): number {
  return new Date(event.timestamp).getTime()
}

function eventEndMs(event: NetworkEvent): number {
  const start = eventStartMs(event)
  const dur = event.durationMs != null && event.durationMs > 0 ? event.durationMs : FALLBACK_DURATION_MS
  return start + dur
}

/**
 * Absolute-time bars for waterfall / gantt. Optional depth from trace forest DFS.
 */
export function buildTimingWindow(
  events: NetworkEvent[],
  depthById?: Map<string, number>
): TimingWindow {
  if (events.length === 0) {
    return { t0: 0, t1: 1, spanMs: 1, bars: [] }
  }

  let t0 = Infinity
  let t1 = -Infinity
  for (const event of events) {
    t0 = Math.min(t0, eventStartMs(event))
    t1 = Math.max(t1, eventEndMs(event))
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) {
    t1 = t0 + 1
  }

  const spanMs = Math.max(t1 - t0, 1)
  const bars: TimingBar[] = events.map((event) => {
    const start = eventStartMs(event)
    const end = eventEndMs(event)
    return {
      event,
      startMs: start - t0,
      endMs: end - t0,
      durationMs: Math.max(end - start, 1),
      depth: depthById?.get(event.id) ?? 0,
    }
  })

  bars.sort((a, b) => a.startMs - b.startMs || a.depth - b.depth)
  return { t0, t1, spanMs, bars }
}

export interface JourneyStep {
  key: string
  label: string
  /** Earliest activity for ordering */
  firstTs: number
  /** Hops that fired under this screen and/or were consumed by it */
  events: NetworkEvent[]
}

const PREFETCH_KEY = '__prefetch__'
const OTHER_KEY = '__other__'

/**
 * Journey steps from usage.screen (+ prefetch bucket for hops with no screen).
 * A hop with multiple screens appears under each consumer step.
 */
export function buildJourneySteps(events: NetworkEvent[]): JourneyStep[] {
  const byKey = new Map<string, JourneyStep>()

  const ensure = (key: string, label: string, ts: number): JourneyStep => {
    let step = byKey.get(key)
    if (!step) {
      step = { key, label, firstTs: ts, events: [] }
      byKey.set(key, step)
    } else {
      step.firstTs = Math.min(step.firstTs, ts)
    }
    return step
  }

  const seenInStep = new Map<string, Set<string>>()

  const add = (key: string, label: string, event: NetworkEvent) => {
    const ts = eventStartMs(event)
    const step = ensure(key, label, ts)
    let ids = seenInStep.get(key)
    if (!ids) {
      ids = new Set()
      seenInStep.set(key, ids)
    }
    if (ids.has(event.id)) return
    ids.add(event.id)
    step.events.push(event)
  }

  for (const event of events) {
    const screens = new Set<string>()
    for (const u of usageList(event.usage)) {
      const screen = u.screen?.trim()
      if (screen) screens.add(screen)
    }

    if (screens.size === 0) {
      const bucket = event.parentRequestId ? OTHER_KEY : PREFETCH_KEY
      const label = bucket === PREFETCH_KEY ? 'Prefetch / login' : 'Unattributed'
      add(bucket, label, event)
      continue
    }

    for (const screen of screens) {
      add(`screen:${screen}`, screen, event)
    }
  }

  const steps = [...byKey.values()].sort((a, b) => a.firstTs - b.firstTs)
  for (const step of steps) {
    step.events.sort((a, b) => eventStartMs(a) - eventStartMs(b))
  }
  return steps
}
