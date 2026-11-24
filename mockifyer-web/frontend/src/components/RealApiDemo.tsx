/**
 * Side-by-side: static recorded public-API response vs generated mocks.
 * No live network — samples are bundled constants.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEFAULT_SEED } from '@/lib/mock-data-generator/defaults'
import {
  DEFAULT_REAL_API_EXAMPLE,
  REAL_API_EXAMPLES,
  type RealApiExample,
} from '@/lib/mock-data-generator/real-api-examples'
import { loadGeneratorEngine } from '@/lib/mock-data-generator/engine'

interface RealApiDemoProps {
  onUseAsSample?: (example: RealApiExample) => void
}

export default function RealApiDemo({ onUseAsSample }: RealApiDemoProps) {
  const [exampleId, setExampleId] = useState(DEFAULT_REAL_API_EXAMPLE.id)
  const [generated, setGenerated] = useState<unknown[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const example =
    REAL_API_EXAMPLES.find((item) => item.id === exampleId) ?? DEFAULT_REAL_API_EXAMPLE

  const runGenerate = useCallback(async (next: RealApiExample) => {
    const token = ++seq.current
    setBusy(true)
    setError(null)
    try {
      const engine = await loadGeneratorEngine()
      const records = await engine.generateAsync(next.recorded, {
        seed: DEFAULT_SEED,
        count: 2,
        context: next.context,
      })
      if (token !== seq.current) return
      setGenerated(records)
    } catch (err) {
      if (token !== seq.current) return
      setError(err instanceof Error ? err.message : String(err))
      setGenerated(null)
    } finally {
      if (token === seq.current) setBusy(false)
    }
  }, [])

  useEffect(() => {
    void runGenerate(example)
  }, [example, runGenerate])

  return (
    <section
      className="border border-border rounded-xl bg-white px-5 py-8 sm:px-8 space-y-5"
      data-testid="real-api-section"
      aria-labelledby="real-api-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            <Radio className="h-4 w-4" aria-hidden />
            Real API → mock data
          </div>
          <h2 id="real-api-heading" className="text-2xl font-semibold tracking-tight">
            Recorded from a real API, then generated
          </h2>
          <p className="text-sm text-muted-foreground">
            These samples are static captures bundled with the page — nothing is fetched live.
            With Mockifyer you record the real API once, then generate variants from the recorded
            mock file (same structure, fresh values, edge cases).
          </p>
        </div>
        <div className="w-full sm:w-56 shrink-0 space-y-1">
          <label htmlFor="real-api-example" className="text-xs font-medium text-muted-foreground">
            Example
          </label>
          <Select
            value={exampleId}
            onValueChange={(value) => {
              setExampleId(value)
            }}
          >
            <SelectTrigger id="real-api-example" data-testid="real-api-example-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REAL_API_EXAMPLES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Source (display only):{' '}
        <span className="font-mono break-all">{example.sourceUrl}</span>
        <span className="mx-1.5">·</span>
        {example.capturedNote}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2" data-testid="real-api-recorded">
          <h3 className="text-sm font-semibold">Recorded from real API</h3>
          <pre className="max-h-[280px] overflow-auto rounded-lg border border-border bg-zinc-50 p-3 text-xs font-mono">
            {JSON.stringify(example.recorded, null, 2)}
          </pre>
        </div>
        <div className="space-y-2 relative" data-testid="real-api-generated">
          <h3 className="text-sm font-semibold">Your mock data, same structure</h3>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {!generated && !error ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </div>
          ) : null}
          {generated ? (
            <pre className="max-h-[280px] overflow-auto rounded-lg border border-border bg-zinc-50 p-3 text-xs font-mono">
              {JSON.stringify(generated, null, 2)}
            </pre>
          ) : null}
          {busy && generated ? (
            <div className="absolute top-8 right-2 rounded-md bg-white/90 border px-2 py-1 text-xs flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating…
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {onUseAsSample ? (
          <Button
            type="button"
            size="sm"
            data-testid="real-api-use-sample"
            onClick={() => onUseAsSample(example)}
          >
            Use as sample
          </Button>
        ) : null}
        <Link
          to="/getting-started"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          How to record a real API
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
