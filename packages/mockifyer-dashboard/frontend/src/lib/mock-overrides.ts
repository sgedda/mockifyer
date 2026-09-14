import type { MockFile, OverridePreview } from '@/types'

/** True when the list API reported date or field overlays on this mock. */
export function mockHasListOverrides(mock: MockFile): boolean {
  return mock.hasResponseFieldOverrides === true || mock.hasResponseDateOverrides === true
}

export interface LabeledOverridePreview extends OverridePreview {
  kind: 'field' | 'date'
}

/** Field overlays first (booking status etc.), then date offsets. */
export function mockOverridePreviewLines(mock: MockFile): LabeledOverridePreview[] {
  const field = Array.isArray(mock.responseFieldOverridesPreview)
    ? mock.responseFieldOverridesPreview.map((row) => ({ ...row, kind: 'field' as const }))
    : []
  const date = Array.isArray(mock.responseDateOverridesPreview)
    ? mock.responseDateOverridesPreview.map((row) => ({ ...row, kind: 'date' as const }))
    : []
  return [...field, ...date]
}

export function formatOverridePreviewLine(path: string, summary: string): string {
  if (!path) return summary
  if (!summary) return path
  return `${path}: ${summary}`
}
