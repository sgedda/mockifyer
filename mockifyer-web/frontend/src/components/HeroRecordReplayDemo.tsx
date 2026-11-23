/**
 * Compact before/after illustration for the home hero.
 * Qualitative only — no invented timings or benchmark claims.
 */
export default function HeroRecordReplayDemo() {
  const responseJson = `{
  "id": 42,
  "status": "confirmed",
  "price": 189
}`

  return (
    <div
      className="w-full max-w-3xl mx-auto rounded-xl border border-border bg-card overflow-hidden shadow-sm"
      aria-label="Live API call versus the same call replayed from a Mockifyer mock"
    >
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-4 sm:p-5 text-left">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live API
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Slow, varies
            </span>
          </div>

          <div className="font-mono text-[11px] sm:text-xs space-y-2">
            <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
              <span className="text-blue-600 dark:text-blue-400">GET</span>{' '}
              <span className="text-foreground break-all">
                https://api.example.com/trips/42
              </span>
            </div>

            <div className="hero-demo-live-panel rounded-md border border-border bg-background px-2.5 py-2">
              <div className="hero-demo-live-wait text-muted-foreground">
                Waiting on network…
              </div>
              <div className="hero-demo-live-body text-foreground whitespace-pre-wrap leading-relaxed px-2.5 py-2">
                {responseJson}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 text-left bg-primary/[0.03]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Mockifyer replay
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              Instant, stable
            </span>
          </div>

          <div className="font-mono text-[11px] sm:text-xs space-y-2">
            <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
              <span className="text-blue-600 dark:text-blue-400">GET</span>{' '}
              <span className="text-foreground break-all">
                https://api.example.com/trips/42
              </span>
            </div>

            <div className="rounded-md border border-primary/25 bg-background px-2.5 py-2 min-h-[5.5rem] !p-2.5">
              <div className="text-[10px] text-primary mb-1 font-sans font-medium">
                Served from mock · no network
              </div>
              <div className="hero-demo-replay-body text-foreground whitespace-pre-wrap leading-relaxed">
                {responseJson}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="border-t border-border px-4 py-2.5 text-center text-xs text-muted-foreground bg-muted/20">
        Same request shape — live traffic recorded once, then replayed as a JSON mock.
      </p>
    </div>
  )
}
