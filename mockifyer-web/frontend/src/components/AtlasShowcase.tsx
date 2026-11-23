import { ArrowRight, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Homepage showcase: cropped static preview of the WanderWeird Atlas
 * generated from real e2e traffic, linking to the hosted interactive page.
 */
export default function AtlasShowcase() {
  return (
    <section
      id="atlas-showcase"
      className="mx-auto max-w-[1200px] px-5 py-16 border-b border-border"
      aria-labelledby="atlas-showcase-heading"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 text-primary mb-3">
          <Map className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-medium uppercase tracking-wide">Atlas</span>
        </div>
        <h2
          id="atlas-showcase-heading"
          className="text-3xl font-semibold tracking-tight mb-3"
        >
          See what Mockifyer sees
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Generated from real WanderWeird recorded traffic — not a code-only scan.
          The map shows hosts and endpoints, request flows across services, and which
          hops were mocked vs live.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <a
          href="/atlas/wanderweird/"
          className="group block rounded-xl border border-border bg-card overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img
            src="/images/wanderweird-atlas-preview.jpg"
            alt="WanderWeird Atlas architecture map: 21 observed endpoints and 1213 requests across mocked and live hops"
            width={1100}
            height={720}
            loading="lazy"
            decoding="async"
            className="w-full h-auto block"
          />
        </a>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-6">
            {/* Full page navigation — Atlas is static HTML, not a React route */}
            <a href="/atlas/wanderweird/">
              Open interactive Atlas
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <a
            href="/guides/mockifyer-atlas"
            className="text-sm text-primary hover:underline font-medium"
          >
            How Atlas works →
          </a>
        </div>
      </div>
    </section>
  )
}
