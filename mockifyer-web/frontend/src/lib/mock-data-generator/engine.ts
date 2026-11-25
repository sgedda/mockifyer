/**
 * Lazy entry for `@sgedda/mockifyer-generator` so the playground route chunk
 * stays small until Generate (or first infer) runs.
 */

import { loadLocaleWithRecovery, type LocaleLoadResult } from './locale-load'

export type GeneratorEngine = typeof import('@sgedda/mockifyer-generator')

let enginePromise: Promise<GeneratorEngine> | null = null

export function loadGeneratorEngine(): Promise<GeneratorEngine> {
  if (!enginePromise) {
    enginePromise = import('@sgedda/mockifyer-generator').catch((err) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise
}

export interface GenerateAsyncSafeResult {
  records: unknown[]
  locale: LocaleLoadResult
}

/**
 * generateAsync with locale-chunk recovery (retry → reload once → en fallback).
 */
export async function generateAsyncSafe(
  sample: unknown,
  options: Parameters<GeneratorEngine['generateAsync']>[1]
): Promise<GenerateAsyncSafeResult> {
  const engine = await loadGeneratorEngine()
  const requested = options?.locale ?? 'en'
  const locale = await loadLocaleWithRecovery(engine.loadLocale, String(requested))
  const records = await engine.generateAsync(sample, {
    ...options,
    locale: locale.locale,
  })
  return { records, locale }
}
