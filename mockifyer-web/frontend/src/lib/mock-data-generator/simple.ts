/**
 * Shared “simple out of the box” helpers for the start-page teaser and tool page.
 * Object count maps to either root `count` or nested `itemCount` depending on sample shape.
 */

import {
  DEFAULT_SEED,
  findPreset,
  presetSampleJson,
  type PlaygroundPreset,
  type PlaygroundPresetId,
} from './defaults'
import { encodeShareHash } from './share-state'

/** Quick types shown in the simple selector (Users … Bookings). */
export const SIMPLE_TYPES: readonly { id: PlaygroundPresetId; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
  { id: 'blog', label: 'Posts' },
  { id: 'payments', label: 'Payments' },
  { id: 'flights', label: 'Bookings' },
] as const

export const SIMPLE_OBJECT_COUNTS = [1, 5, 10, 25] as const
export type SimpleObjectCount = (typeof SIMPLE_OBJECT_COUNTS)[number]

export const DEFAULT_SIMPLE_COUNT: SimpleObjectCount = 5
export const DEFAULT_SIMPLE_TYPE_ID: PlaygroundPresetId = 'users'

export function isSimpleObjectCount(value: number): value is SimpleObjectCount {
  return (SIMPLE_OBJECT_COUNTS as readonly number[]).includes(value)
}

export function clampToSimpleObjectCount(value: number): SimpleObjectCount {
  if (isSimpleObjectCount(value)) return value
  // Nearest option
  let best: SimpleObjectCount = DEFAULT_SIMPLE_COUNT
  let bestDist = Number.POSITIVE_INFINITY
  for (const option of SIMPLE_OBJECT_COUNTS) {
    const dist = Math.abs(option - value)
    if (dist < bestDist) {
      best = option
      bestDist = dist
    }
  }
  return best
}

/**
 * Samples shaped like `{ users: […] }` (single top-level list key) get
 * `itemCount = N` (one wrapper, N entities). Object samples with nested lists
 * (orders with `items`) get `count = N` root records.
 */
export function resolveSimpleGenerateOptions(
  sample: unknown,
  objectCount: number
): { count: number; itemCount?: number } {
  if (sample !== null && typeof sample === 'object' && !Array.isArray(sample)) {
    const keys = Object.keys(sample as Record<string, unknown>)
    if (keys.length === 1) {
      const only = (sample as Record<string, unknown>)[keys[0]!]
      if (Array.isArray(only)) {
        return { count: 1, itemCount: objectCount }
      }
    }
  }
  return { count: objectCount }
}

/** Prefer a single object preview when only one root record was generated. */
export function formatSimpleOutput(records: unknown[]): unknown {
  if (records.length === 1) {
    return records[0]
  }
  return records
}

export function newRandomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}

export function simplePreset(id: PlaygroundPresetId): PlaygroundPreset {
  const preset = findPreset(id)
  if (!preset) {
    throw new Error(`Unknown simple preset: ${id}`)
  }
  return preset
}

export function buildSimpleToolHref(opts: {
  preset: PlaygroundPreset
  objectCount: number
  seed?: number | string
}): string {
  const size = resolveSimpleGenerateOptions(opts.preset.sample, opts.objectCount)
  const encoded = encodeShareHash({
    input: presetSampleJson(opts.preset),
    context: opts.preset.context,
    seed: opts.seed ?? DEFAULT_SEED,
    count: size.count,
    itemCount: size.itemCount,
    level: 'wild',
    checked: [],
    overrides: {},
  })
  if (!encoded.ok) {
    return '/tools/mock-data-generator'
  }
  return `/tools/mock-data-generator${encoded.hash}`
}
