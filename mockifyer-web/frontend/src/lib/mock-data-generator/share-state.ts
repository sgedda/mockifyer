/**
 * Shareable URL hash state for the mock-data-generator playground (SGE-77).
 * Encodes input (compressed), context, seed, count, chaos slider, and checklist.
 */

import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import { fromBase64Url, toBase64Url } from './bytes'
import {
  CHAOS_LEVELS,
  MAX_SHARE_HASH_LENGTH,
  type PlaygroundChaosLevel,
} from './defaults'

export const SHARE_HASH_PREFIX = 'mdg1.'

export interface PlaygroundShareState {
  input: string
  context: string
  seed: number | string
  count: number
  /**
   * Nested list length (`itemCount`). When set, overrides context phrases like
   * `"5 items"`. Omitted means “auto” (context / sample length).
   */
  itemCount?: number
  level: PlaygroundChaosLevel
  /** Variant kind slugs checked in the resilience checklist. */
  checked: string[]
  /** Optional field-kind overrides: path → kind. */
  overrides?: Record<string, string>
}

export type EncodeShareResult =
  | { ok: true; hash: string }
  | { ok: false; reason: 'too_large'; approximateLength: number }

function compactPayload(state: PlaygroundShareState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    i: state.input,
    c: state.context,
    s: state.seed,
    n: state.count,
    l: state.level,
    k: state.checked,
  }
  if (typeof state.itemCount === 'number' && Number.isFinite(state.itemCount)) {
    payload.m = state.itemCount
  }
  if (state.overrides && Object.keys(state.overrides).length > 0) {
    payload.o = state.overrides
  }
  return payload
}

function expandPayload(raw: Record<string, unknown>): PlaygroundShareState | null {
  if (typeof raw.i !== 'string') return null
  const levelRaw = typeof raw.l === 'string' ? raw.l : 'mild'
  const level = (CHAOS_LEVELS as readonly string[]).includes(levelRaw)
    ? (levelRaw as PlaygroundChaosLevel)
    : 'mild'
  const checked = Array.isArray(raw.k)
    ? raw.k.filter((item): item is string => typeof item === 'string')
    : []
  const overrides =
    raw.o && typeof raw.o === 'object' && !Array.isArray(raw.o)
      ? Object.fromEntries(
          Object.entries(raw.o as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
          )
        )
      : undefined

  return {
    input: raw.i,
    context: typeof raw.c === 'string' ? raw.c : '',
    seed: typeof raw.s === 'number' || typeof raw.s === 'string' ? raw.s : 42,
    count: typeof raw.n === 'number' && Number.isFinite(raw.n) ? raw.n : 1,
    itemCount:
      typeof raw.m === 'number' && Number.isFinite(raw.m) ? Math.trunc(raw.m) : undefined,
    level,
    checked,
    overrides,
  }
}

/**
 * Encode playground state into a URL hash fragment (including leading `#`).
 */
export function encodeShareHash(state: PlaygroundShareState): EncodeShareResult {
  const json = JSON.stringify(compactPayload(state))
  const compressed = deflateSync(strToU8(json), { level: 9 })
  const hash = `#${SHARE_HASH_PREFIX}${toBase64Url(compressed)}`
  if (hash.length > MAX_SHARE_HASH_LENGTH) {
    return { ok: false, reason: 'too_large', approximateLength: hash.length }
  }
  return { ok: true, hash }
}

/**
 * Decode a URL hash (with or without `#`) into playground state.
 * Returns null when the hash is missing, malformed, or not a share payload.
 */
export function decodeShareHash(hash: string | null | undefined): PlaygroundShareState | null {
  if (!hash) return null
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw.startsWith(SHARE_HASH_PREFIX)) return null
  try {
    const bytes = fromBase64Url(raw.slice(SHARE_HASH_PREFIX.length))
    const json = strFromU8(inflateSync(bytes))
    const parsed = JSON.parse(json) as Record<string, unknown>
    return expandPayload(parsed)
  } catch {
    return null
  }
}

/** True when `hash` is a playground share payload (not an in-page anchor). */
export function isPlaygroundShareHash(hash: string | null | undefined): boolean {
  if (!hash) return false
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  return raw.startsWith(SHARE_HASH_PREFIX)
}
