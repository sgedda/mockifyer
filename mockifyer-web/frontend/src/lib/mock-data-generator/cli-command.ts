import type { PlaygroundChaosLevel } from './defaults'

export interface SampleCliOptions {
  seed: number | string
  count: number
  context: string
  /** When set, include `--locale` (e.g. after context parse). */
  locale?: string
  sampleFile?: string
}

export interface VariantsCliOptions {
  seed: number | string
  level: PlaygroundChaosLevel
  mockFile?: string
  outDir?: string
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Equivalent local CLI for generating records from a JSON sample.
 * Uses the real bin: `npx -p @sgedda/mockifyer-generator mockifyer-generate`.
 */
export function buildSampleCliCommand(options: SampleCliOptions): string {
  const sampleFile = options.sampleFile ?? 'sample.json'
  const parts = [
    'npx -p @sgedda/mockifyer-generator mockifyer-generate sample',
    sampleFile,
    `--seed ${options.seed}`,
    `--count ${options.count}`,
  ]
  if (options.context.trim()) {
    parts.push(`--context ${shellSingleQuote(options.context.trim())}`)
  }
  if (options.locale && options.locale !== 'en') {
    parts.push(`--locale ${options.locale}`)
  }
  return parts.join(' ')
}

/**
 * Equivalent local CLI for edge-case variants.
 */
export function buildVariantsCliCommand(options: VariantsCliOptions): string {
  const mockFile = options.mockFile ?? 'sample.json'
  const outDir = options.outDir ?? './mock-data'
  return [
    'npx -p @sgedda/mockifyer-generator mockifyer-generate variants',
    mockFile,
    `--level ${options.level}`,
    `--seed ${options.seed}`,
    `--out ${outDir}`,
  ].join(' ')
}
