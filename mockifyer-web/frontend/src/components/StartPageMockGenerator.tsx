/**
 * Compact light-mode mock-data teaser for the start page.
 * Lazy-loads the generator engine after idle / visibility — keeps the main bundle lean.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2, Shuffle, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const START_PRESET = findPreset('users') ?? TEASER_PRESETS[0]!

function buildFullGeneratorHref(opts: {
  preset: PlaygroundPreset
  context: string
  seed: number
}): string {
  const encoded = encodeShareHash({
    input: presetSampleJson(opts.preset),
    context: opts.context,
    seed: opts.seed,
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
      return { [key]: (value as unknown[]).slice(0, 2) }
    }
    // Single object record (weather/orders) — show first record only
    return first
  }
  return records.slice(0, 2)
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
  const [context, setContext] = useState(START_PRESET.context)
  const [seed, setSeed] = useState(DEFAULT_SEED)
  const [records, setRecords] = useState<unknown[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const engineStarted = useRef(false)
  const generateSeq = useRef(0)

  const preset = findPreset(presetId) ?? START_PRESET

  const runGenerate = useCallback(
    async (next: { preset: PlaygroundPreset; context: string; seed: number }) => {
      const seq = ++generateSeq.current
      setBusy(true)
      setError(null)
      try {
        const engine = await loadGeneratorEngine()
        const generated = await engine.generateAsync(next.preset.sample, {
          seed: next.seed,
          count: 2,
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
    },
    []
  )

  // Load engine once the section is near the viewport (or after idle).
  useEffect(() => {
    let cancelled = false
    let cancelIdle: (() => void) | undefined
    let observer: IntersectionObserver | undefined

    const start = () => {
      if (cancelled || engineStarted.current) return
      engineStarted.current = true
      observer?.disconnect()
      void runGenerate({ preset: START_PRESET, context: START_PRESET.context, seed: DEFAULT_SEED })
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
    // Idle fallback so generation still starts if the section is off-screen
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
    setContext(next.context)
    void runGenerate({ preset: next, context: next.context, seed })
  }

  const onShuffle = () => {
    const nextSeed = Math.floor(Math.random() * 1_000_000_000)
    setSeed(nextSeed)
    void runGenerate({ preset, context, seed: nextSeed })
  }

  const onContextBlurOrEnter = () => {
    void runGenerate({ preset, context, seed })
  }

  const fullHref = buildFullGeneratorHref({ preset, context, seed })

  return (
    <section
      ref={rootRef}
      className="bg-white text-zinc-950 border-b border-zinc-200"
      data-testid="start-page-mock-generator"
    >
      <div className="mx-auto max-w-[1200px] px-5 py-14 sm:py-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              <Wand2 className="h-4 w-4" aria-hidden />
              Mock data generator
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Paste once. Get realistic data.
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Live preview from one sample — runs in your browser. Open the full tool for kinds,
              edge cases, and downloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Sample presets"
              data-testid="start-presets"
            >
              {TEASER_PRESETS.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={item.id === presetId ? 'default' : 'outline'}
                  data-testid={`start-preset-${item.id}`}
                  disabled={busy && !records}
                  onClick={() => onPreset(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="start-shuffle"
              onClick={onShuffle}
              disabled={busy && !records}
            >
              <Shuffle className="h-3.5 w-3.5 mr-1.5" />
              Shuffle
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
          <div className="space-y-2">
            <label htmlFor="start-context" className="text-xs font-medium text-zinc-600">
              Context
            </label>
            <Input
              id="start-context"
              data-testid="start-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onBlur={onContextBlurOrEnter}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onContextBlurOrEnter()
                }
              }}
              placeholder="swedish users, 5 items"
              className="bg-white"
            />
            <p className="text-xs text-zinc-500">Seed {seed} · 2 records</p>
            <Link
              to={fullHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
              data-testid="start-open-full-generator"
            >
              Open the full generator
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div
            className="relative min-h-[220px] rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden"
            data-testid="start-generated-output"
          >
            {!records && !error ? (
              <div
                className="absolute inset-0 flex flex-col gap-3 p-4 animate-pulse"
                data-testid="start-generator-skeleton"
                aria-busy="true"
                aria-label="Loading generator"
              >
                <div className="h-3 w-1/3 rounded bg-zinc-200" />
                <div className="h-3 w-full rounded bg-zinc-200" />
                <div className="h-3 w-5/6 rounded bg-zinc-200" />
                <div className="h-3 w-2/3 rounded bg-zinc-200" />
                <div className="mt-auto flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading generator…
                </div>
              </div>
            ) : null}
            {error ? (
              <p className="p-4 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            {records ? (
              <div className="max-h-[320px] overflow-auto">
                <pre
                  className="p-4 text-xs font-mono text-zinc-800"
                  data-testid="start-generated-preview"
                >
                  {JSON.stringify(previewGeneratedRecords(records), null, 2)}
                </pre>
                <details className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-600">
                  <summary className="cursor-pointer select-none font-medium">
                    Full JSON ({records.length} record{records.length === 1 ? '' : 's'})
                  </summary>
                  <pre className="mt-2 pb-3 font-mono text-zinc-700 whitespace-pre-wrap break-all">
                    {JSON.stringify(records, null, 2)}
                  </pre>
                </details>
              </div>
            ) : null}
            {busy && records ? (
              <div className="absolute top-2 right-2 rounded-md bg-white/90 border border-zinc-200 px-2 py-1 text-xs text-zinc-600 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating…
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
