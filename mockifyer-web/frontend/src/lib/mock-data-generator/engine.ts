/**
 * Lazy entry for `@sgedda/mockifyer-generator` so the playground route chunk
 * stays small until Generate (or first infer) runs.
 */

export type GeneratorEngine = typeof import('@sgedda/mockifyer-generator')

let enginePromise: Promise<GeneratorEngine> | null = null

export function loadGeneratorEngine(): Promise<GeneratorEngine> {
  if (!enginePromise) {
    enginePromise = import('@sgedda/mockifyer-generator')
  }
  return enginePromise
}
