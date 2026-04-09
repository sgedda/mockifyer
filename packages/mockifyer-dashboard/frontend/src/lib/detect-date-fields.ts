import type { MockResponseDateOverride } from '@/types'

const MAX_PATHS = 250

/** Rough bounds so we don't flag arbitrary integers as timestamps. */
function isLikelyUnixMs(n: number): boolean {
  return n > 1e11 && n < 1e14
}

function isLikelyUnixSeconds(n: number): boolean {
  return n > 1e9 && n < 1e11
}

function isLikelyDateString(s: string): boolean {
  const t = s.trim()
  if (t.length < 8 || t.length > 80) return false
  if (/^\d+$/.test(t)) return false
  const ms = Date.parse(t)
  if (Number.isNaN(ms)) return false
  const y = new Date(ms).getUTCFullYear()
  return y >= 1970 && y <= 2100
}

/** Aligns with mockifyer-core override behavior (auto vs explicit format). */
export function inferFormatForOverrideValue(
  value: unknown
): MockResponseDateOverride['format'] | undefined {
  if (typeof value === 'string') return 'iso'
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (isLikelyUnixMs(value)) return 'unix-ms'
    if (isLikelyUnixSeconds(value)) return 'unix-s'
  }
  return undefined
}

function getAtPath(root: unknown, segments: string[]): unknown {
  let cur: unknown = root
  for (const s of segments) {
    if (cur === null || cur === undefined) return undefined
    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[s]
  }
  return cur
}

export function parsePathSegments(path: string): string[] {
  return path.split('.').filter(Boolean)
}

export interface DateFieldCandidate {
  path: string
  preview: string
  suggestedFormat: MockResponseDateOverride['format'] | undefined
}

function pushCandidate(
  out: DateFieldCandidate[],
  path: string,
  value: unknown
): void {
  if (out.length >= MAX_PATHS) return
  let preview = ''
  if (typeof value === 'string') {
    preview = value.length > 48 ? `${value.slice(0, 45)}…` : value
  } else if (typeof value === 'number') {
    preview = String(value)
  }
  out.push({
    path,
    preview,
    suggestedFormat: inferFormatForOverrideValue(value),
  })
}

/**
 * Walk JSON (response body root) and collect dot-paths whose values look like dates
 * (ISO-like strings, unix ms, unix seconds).
 */
export function detectDateLikeFields(root: unknown): DateFieldCandidate[] {
  const out: DateFieldCandidate[] = []

  function walk(value: unknown, segments: string[]): void {
    if (out.length >= MAX_PATHS) return

    if (value === null || value === undefined) return

    if (typeof value === 'string') {
      if (isLikelyDateString(value)) {
        pushCandidate(out, segments.join('.'), value)
      }
      return
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (isLikelyUnixMs(value) || isLikelyUnixSeconds(value)) {
        pushCandidate(out, segments.join('.'), value)
      }
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        walk(item, [...segments, String(i)])
      })
      return
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value as object)
      for (const k of keys) {
        walk((value as Record<string, unknown>)[k], [...segments, k])
      }
    }
  }

  if (root === null || root === undefined) return out

  // Root must be an object/array for path-based overrides; skip primitive-only bodies here.
  if (typeof root !== 'object') {
    return out
  }

  walk(root, [])
  const seen = new Set<string>()
  const deduped: DateFieldCandidate[] = []
  for (const c of out) {
    if (seen.has(c.path)) continue
    seen.add(c.path)
    deduped.push(c)
  }
  deduped.sort((a, b) => a.path.localeCompare(b.path))
  return deduped
}

export function getValueAtResponsePath(root: unknown, path: string): unknown {
  if (path === '') return root
  return getAtPath(root, parsePathSegments(path))
}
