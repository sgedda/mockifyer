import type { NetworkEvent, NetworkEventUsage } from '@/types'

export function usageList(usage: NetworkEvent['usage']): NetworkEventUsage[] {
  if (!usage) return []
  return Array.isArray(usage) ? usage : [usage]
}

export function formatUsage(u: NetworkEventUsage): string {
  if (u.label) return u.label
  const parts = [u.screen, u.component].filter(Boolean)
  if (parts.length) return parts.join(' / ')
  if (u.cms?.type) return u.cms.type
  if (u.datasourceId) return u.datasourceId
  return 'app'
}

export function primaryScreen(event: NetworkEvent): string | null {
  for (const u of usageList(event.usage)) {
    if (u.screen?.trim()) return u.screen.trim()
  }
  return null
}
