import type { NetworkEvent } from '@/types'

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
