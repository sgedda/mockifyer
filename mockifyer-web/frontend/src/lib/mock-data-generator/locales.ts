/**
 * Friendly locale picker for the mock data generator playground.
 */

export const PLAYGROUND_LOCALES = [
  { id: 'en', label: 'English (US)', flag: '🇺🇸' },
  { id: 'sv', label: 'Swedish', flag: '🇸🇪' },
  { id: 'de', label: 'German', flag: '🇩🇪' },
  { id: 'fr', label: 'French', flag: '🇫🇷' },
  { id: 'es', label: 'Spanish', flag: '🇪🇸' },
] as const

export type PlaygroundLocaleId = (typeof PLAYGROUND_LOCALES)[number]['id']

export const DEFAULT_PLAYGROUND_LOCALE: PlaygroundLocaleId = 'en'

export function isPlaygroundLocaleId(value: unknown): value is PlaygroundLocaleId {
  return (
    typeof value === 'string' &&
    PLAYGROUND_LOCALES.some((item) => item.id === value)
  )
}

export function parsePlaygroundLocale(value: unknown): PlaygroundLocaleId {
  return isPlaygroundLocaleId(value) ? value : DEFAULT_PLAYGROUND_LOCALE
}

/** Infer locale from free-text context when hydrating older share links. */
export function localeFromContext(context: string): PlaygroundLocaleId {
  const lower = context.toLowerCase()
  if (/\b(swedish|svenska|sweden|\bsv\b)\b/.test(lower)) return 'sv'
  if (/\b(german|deutsch|germany|\bde\b)\b/.test(lower)) return 'de'
  if (/\b(french|français|francais|france|\bfr\b)\b/.test(lower)) return 'fr'
  if (/\b(spanish|español|espanol|spain|\bes\b)\b/.test(lower)) return 'es'
  return 'en'
}
