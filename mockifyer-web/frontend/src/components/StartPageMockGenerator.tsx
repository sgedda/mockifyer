/**
 * Compact light-mode mock-data teaser for the start page (below Atlas).
 * Lazy-loads the generator engine after idle / visibility — keeps the main bundle lean.
 * No context input or Shuffle — those live on the full tool page.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_COUNT,
  DEFAULT_SEED,
  TEASER_PRESETS,
  findPreset,
  presetSampleJson,
  type PlaygroundPreset,
} from '@/lib/mock-data-generator/defaults'
import { encodeShareHash } from '@/lib/mock-data-generator/share-state'
import { loadGeneratorEngine } from '@/lib/mock-data-generator/engine'

/** Keep the start-page chip row to 2–3 presets. */
const COMPACT_PRESETS = TEASER_PRESETS.slice(0, 3)
const START_PRESET = findPreset('users') ?? COMPACT_PRESETS[0]!
const PREVIEW_MAX_LINES = 7

function buildFullGeneratorHref(preset: PlaygroundPreset): string {
  const encoded = encodeShareHash({
    input: presetSampleJson(preset),
    context: preset.context,
    seed: DEFAULT_SEED,
    count: DEFAULT_COUNT,
    level: 'wild',
    checked: [],
    overrides: {},
  })
  if (!encoded.ok) {
    return '/tools/mock-data-generator'
  }
  return `/tools/mock-data-generator${encoded.hash}`
}

/**
 * Readable teaser preview: prefer the first nested entity list (e.g. `users`)
 * sliced to a few items, instead of dumping the wrapper `[{ users: [...] }, …]`.
 */
function previewGeneratedRecords(records: unknown[]): unknown {
  if (records.length === 0) {
    return records
  }
  const first = records[0]
  if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
    const entries = Object.entries(first as Record<string, unknown>)
    const listEntry = entries.find(
      ([, value]) => Array.isArray(value) && (value as unknown[]).length > 0
    )
    if (listEntry) {
      const [key, value] = listEntry
      return { [key]: (value as unknown[]).slice(0, 1) }
    }
    return first
  }
  return records.slice(0, 1)
}

/** Pretty-print to a fixed line budget — no scroll box on the start page. */
function compactPreviewText(value: unknown, maxLines: number): string {
  const full = JSON.stringify(value, null, 2)
  const lines = full.split('\n')
  if (lines.length <= maxLines) {
    return full
  }
  return `${lines.slice(0, maxLines - 1).join('\n')}\n  …`
}

function scheduleIdle(callback: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number
    cancelIdleCallback?: (id: number) => void
  }
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(() => callback(), { timeout: 1200 })
    return () => w.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(callback, 200)
  return () => window.clearTimeout(id)
}

export default function StartPageMockGenerator() {
  const rootRef = useRef<HTMLElement | null>(null)
  const [presetId, setPresetId] = useState<PlaygroundPreset['id']>(START_PRESET.id)
  const [records, setRecords] = useState<unknown[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const engineStarted = useRef(false)
  const generateSeq = useRef(0)

  const preset = findPreset(presetId) ?? START_PRESET

  const runGenerate = useCallback(async (next: PlaygroundPreset) => {
    const seq = ++generateSeq.current
    setBusy(true)
    setError(null)
    try {
      const engine = await loadGeneratorEngine()
      const generated = await engine.generateAsync(next.sample, {
        seed: DEFAULT_SEED,
        count: 1,
        context: next.context.trim() || undefined,
      })
      if (seq !== generateSeq.current) return
      setRecords(generated)
    } catch (err) {
      if (seq !== generateSeq.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (seq === generateSeq.current) {
        setBusy(false)
      }
    }
  }, [])

  // Load engine once the section is near the viewport (or after idle).
  useEffect(() => {
    let cancelled = false
    let cancelIdle: (() => void) | undefined
    let observer: IntersectionObserver | undefined

    const start = () => {
      if (cancelled || engineStarted.current) return
      engineStarted.current = true
      observer?.disconnect()
      void runGenerate(START_PRESET)
    }

    const node = rootRef.current
    if (node && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            start()
          }
        },
        { rootMargin: '200px 0px' }
      )
      observer.observe(node)
    }
    cancelIdle = scheduleIdle(start)
    return () => {
      cancelled = true
      observer?.disconnect()
      cancelIdle?.()
    }
  }, [runGenerate])

  const onPreset = (nextId: PlaygroundPreset['id']) => {
    const next = findPreset(nextId) ?? START_PRESET
    setPresetId(next.id)
    void runGenerate(next)
  }

  const fullHref = buildFullGeneratorHref(preset)
  const previewText =
    records != null ? compactPreviewText(previewGeneratedRecords(records), PREVIEW_MAX_LINES) : null

  return (
    <section
      ref={rootRef}
      className="bg-white text-zinc-950 border-b border-zinc-200"
      data-testid="start-page-mock-generator"
    >
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
              Mock data generator
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Paste once. Get realistic data.
            </h2>
            <p className="text-muted-foreground text-sm">
              Live preview in your browser — open the full tool for kinds, edge cases, and downloads.
            </p>
          </div>

          <div
            className="flex flex-wrap gap-1.5 shrink-0"
            role="group"
            aria-label="Sample presets"
            data-testid="start-presets"
          >
            {COMPACT_PRESETS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={item.id === presetId ? 'default' : 'outline'}
                className="min-h-9"
                data-testid={`start-preset-${item.id}`}
                disabled={busy && !records}
                onClick={() => onPreset(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div
            className="relative rounded-lg border border-zinc-200 bg-zinc-50"
            data-testid="start-generated-output"
          >
            {!records && !error ? (
              <div
                className="flex items-center gap-2 p-3 text-xs text-zinc-500"
                data-testid="start-generator-skeleton"
                aria-busy="true"
                aria-label="Loading generator"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading generator…
              </div>
            ) : null}
            {error ? (
              <p className="p-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            {previewText ? (
              <pre
                className="p-3 text-xs font-mono text-zinc-800 whitespace-pre-wrap break-all leading-relaxed"
                data-testid="start-generated-preview"
              >
                {previewText}
              </pre>
            ) : null}
            {busy && records ? (
              <div className="absolute top-2 right-2 rounded-md bg-white/90 border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating…
              </div>
            ) : null}
          </div>

          <Link
            to={fullHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4 min-h-10"
            data-testid="start-open-full-generator"
          >
            Open the full generator
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
