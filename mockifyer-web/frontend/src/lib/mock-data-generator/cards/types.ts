/** Card view models + themes for the mock-data-generator playground. */

export const CARD_THEMES = ['clean', 'glass', 'trading', 'receipt'] as const
export type CardTheme = (typeof CARD_THEMES)[number]

export const DEFAULT_CARD_THEME: CardTheme = 'clean'

export type CardKind = 'user' | 'order' | 'product' | 'generic'

export interface CardField {
  label: string
  value: string
}

export interface MockCard {
  id: string
  kind: CardKind
  title: string
  subtitle?: string
  badge?: string
  /** Large accent value (price, total, …). */
  highlight?: string
  fields: CardField[]
  /** Pretty JSON for the flip face. */
  rawJson: string
}

export type OutputSurface = 'code' | 'cards'

export function isCardTheme(value: unknown): value is CardTheme {
  return typeof value === 'string' && (CARD_THEMES as readonly string[]).includes(value)
}

export function parseCardTheme(value: unknown): CardTheme {
  return isCardTheme(value) ? value : DEFAULT_CARD_THEME
}

export function isOutputSurface(value: unknown): value is OutputSurface {
  return value === 'code' || value === 'cards'
}

export function parseOutputSurface(value: unknown): OutputSurface {
  return isOutputSurface(value) ? value : 'code'
}
