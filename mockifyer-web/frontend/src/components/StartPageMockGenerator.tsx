/**
 * Minimal mock-data teaser for the start page (after Atlas).
 * One tool card: type + count → Generate (dice) → live JSON/types.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Dices, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import GeneratedOutputPanel from '@/components/GeneratedOutputPanel'
import { DEFAULT_SEED } from '@/lib/mock-data-generator/defaults'
import { loadGeneratorEngine } from '@/lib/mock-data-generator/engine'
import {
  DEFAULT_SIMPLE_COUNT,
  DEFAULT_SIMPLE_TYPE_ID,
  SIMPLE_OBJECT_COUNTS,
  SIMPLE_TYPES,
  buildSimpleToolHref,
  formatSimpleOutput,
  newRandomSeed,
  resolveSimpleGenerateOptions,
  simplePreset,
  type SimpleObjectCount,
} from '@/lib/mock-data-generator/simple'
import type { PlaygroundPresetId } from '@/lib/mock-data-generator/defaults'
import { cn } from '@/lib/utils'

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
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [typeId, setTypeId] = useState<PlaygroundPresetId>(DEFAULT_SIMPLE_TYPE_ID)
  const [objectCount, setObjectCount] = useState<SimpleObjectCount>(DEFAULT_SIMPLE_COUNT)
  const [seed, setSeed] = useState<number>(DEFAULT_SEED)
  const [output, setOutput] = useState<unknown | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputStatus, setOutputStatus] = useState<string | null>(null)
  const [outputFlash, setOutputFlash] = useState(false)
  const engineStarted = useRef(false)
  const generateSeq = useRef(0)

  const preset = simplePreset(typeId)

  const announce = useCallback(
    (recordCount: number, nextSeed: number, scroll: boolean) => {
      const label = SIMPLE_TYPES.find((item) => item.id === typeId)?.label ?? 'records'
      const noun =
        recordCount === 1
          ? label.endsWith('s')
            ? label.slice(0, -1).toLowerCase()
            : label.toLowerCase()
          : label.toLowerCase()
      const time = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      setOutputStatus(`Updated · ${recordCount} ${noun} · seed ${nextSeed} · ${time}`)
      setOutputFlash(true)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setOutputFlash(false), 700)
      if (scroll) {
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      }
    },
    [typeId]
  )

  const runGenerate = useCallback(
    async (opts: {
      typeId: PlaygroundPresetId
      objectCount: number
      seed: number
      announce?: boolean
      scroll?: boolean
    }) => {
      const seq = ++generateSeq.current
      setBusy(true)
      setError(null)
      try {
        const next = simplePreset(opts.typeId)
        const size = resolveSimpleGenerateOptions(next.sample, opts.objectCount)
        const engine = await loadGeneratorEngine()
        const generated = await engine.generateAsync(next.sample, {
          seed: opts.seed,
          count: size.count,
          itemCount: size.itemCount,
          context: next.context.trim() || undefined,
        })
        if (seq !== generateSeq.current) return
        setOutput(formatSimpleOutput(generated))
        if (opts.announce) {
          announce(generated.length, opts.seed, opts.scroll ?? false)
        }
      } catch (err) {
        if (seq !== generateSeq.current) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (seq === generateSeq.current) {
          setBusy(false)
        }
      }
    },
    [announce]
  )

  useEffect(() => {
    let cancelled = false
    let cancelIdle: (() => void) | undefined
    let observer: IntersectionObserver | undefined

    const start = () => {
      if (cancelled || engineStarted.current) return
      engineStarted.current = true
      observer?.disconnect()
      void runGenerate({
        typeId: DEFAULT_SIMPLE_TYPE_ID,
        objectCount: DEFAULT_SIMPLE_COUNT,
        seed: DEFAULT_SEED,
      })
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
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [runGenerate])

  const onTypeChange = (nextId: PlaygroundPresetId) => {
    setTypeId(nextId)
    void runGenerate({ typeId: nextId, objectCount, seed, announce: true })
  }

  const onCountChange = (next: SimpleObjectCount) => {
    setObjectCount(next)
    void runGenerate({ typeId, objectCount: next, seed, announce: true })
  }

  const onGenerate = () => {
    const nextSeed = newRandomSeed()
    setSeed(nextSeed)
    void runGenerate({
      typeId,
      objectCount,
      seed: nextSeed,
      announce: true,
      scroll: true,
    })
  }

  const fullHref = buildSimpleToolHref({ preset, objectCount, seed })

  return (
    <section
      ref={rootRef}
      id="mock-data-generator"
      className="mx-auto max-w-[1200px] px-5 py-16 border-b border-border"
      data-testid="start-page-mock-generator"
      aria-labelledby="start-mock-generator-heading"
    >
      <div className="flex flex-col gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-sm font-medium text-primary">Free tools</p>
          <h2
            id="start-mock-generator-heading"
            className="text-3xl font-semibold tracking-tight"
          >
            Free mock data generator
          </h2>
          <p className="text-muted-foreground">
            Standalone browser tool—fake JSON and types with no API required. Pick a type, set how
            many, Generate, then open the full tool for locales, seed control, and more languages.
          </p>
        </div>

        <div
          className="rounded-xl border border-border overflow-hidden bg-zinc-50/60"
          data-testid="start-tool-card"
        >
          <div className="p-4 border-b border-border flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-2 min-w-0 flex-1 sm:flex-none sm:min-w-[200px]" data-testid="start-type">
              <Label htmlFor="start-type-select" className="text-sm font-medium">
                Type
              </Label>
              <Select
                value={typeId}
                onValueChange={(value) => onTypeChange(value as PlaygroundPresetId)}
                disabled={busy && !output}
              >
                <SelectTrigger
                  id="start-type-select"
                  className="min-h-11 w-full sm:w-[200px] bg-white"
                  data-testid="start-type-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIMPLE_TYPES.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      data-testid={`start-type-${item.id}`}
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Number of objects"
              data-testid="start-object-count"
            >
              {SIMPLE_OBJECT_COUNTS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={n === objectCount ? 'default' : 'outline'}
                  className="min-h-11 min-w-11"
                  data-testid={`start-count-${n}`}
                  disabled={busy && !output}
                  onClick={() => onCountChange(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <div
            ref={resultsRef}
            className={cn('p-4 space-y-3 bg-white scroll-mt-4', outputFlash && 'mdg-output-flash')}
            data-testid="start-results"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Generated output</p>
                {outputStatus ? (
                  <p
                    className="text-xs text-muted-foreground truncate"
                    data-testid="start-output-status"
                    aria-live="polite"
                  >
                    {outputStatus}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Press Generate to refresh values with a new seed.
                  </p>
                )}
              </div>
              <Button
                type="button"
                className="min-h-11 w-full sm:w-auto shrink-0"
                data-testid="start-generate"
                disabled={busy && !output}
                onClick={onGenerate}
              >
                {busy && output ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Dices className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
            </div>

            <GeneratedOutputPanel
              output={output}
              busy={busy}
              error={error}
              testIdPrefix="start"
              rootTypeName="Root"
            />
          </div>
        </div>

        <Link
          to={fullHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4 w-fit"
          data-testid="start-open-full-generator"
        >
          Open the full tool
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
