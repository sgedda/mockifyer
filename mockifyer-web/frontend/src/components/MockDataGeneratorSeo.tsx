/**
 * SEO content below the interactive mock data generator (not above the tool).
 */

import { Link } from 'react-router-dom'
import { GENERATOR_FAQ } from '@/lib/mock-data-generator/seo-content'

export default function MockDataGeneratorSeo() {
  return (
    <section
      className="border-t border-border pt-12 sm:pt-16 space-y-10 text-zinc-950"
      data-testid="generator-seo-section"
      aria-label="About the mock data generator"
    >
      <div className="space-y-3 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">What is a mock data generator?</h2>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          A mock data generator creates realistic fake JSON for development and testing when a live
          API is missing, slow, or hard to reproduce. This free tool generates seeded records in
          your browser — a random JSON generator with stable shapes you can copy into fixtures,
          demos, and tests.
        </p>
      </div>

      <div className="space-y-3 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          Generate fake JSON for API testing
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          Pick a type (users, orders, products, posts, payments, bookings), choose how many objects,
          and Randomize for fresh values. Use it as a fake user data generator or to generate a mock
          API response that matches a typical REST payload. Advanced mode accepts your own sample
          JSON so the structure stays yours while values change.
        </p>
      </div>

      <div className="space-y-3 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          Generate types from JSON
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          Switch to the Types tab to turn the current output into typed definitions — nested objects
          become their own types, arrays are typed, and fields that vary across records are marked
          optional. Choose TypeScript by default, or Zod, JSON Schema, C#, Kotlin, Swift, Python, or
          Go, then copy the language you need for mock JSON for testing.
        </p>
      </div>

      <div className="space-y-3 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          From generated data to recorded mocks with Mockifyer
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          Generated JSON is a starting point. When a real backend exists,{' '}
          <Link to="/getting-started" className="text-primary underline-offset-4 hover:underline">
            Getting Started
          </Link>{' '}
          shows how to record live HTTP with Mockifyer, store mocks as JSON in your repo, and replay
          them in CI or on device — so tests use the same shapes the API actually returns.
        </p>
      </div>

      <div className="space-y-4 max-w-3xl" data-testid="generator-faq">
        <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <dl className="space-y-5">
          {GENERATOR_FAQ.map((item) => (
            <div key={item.question} className="space-y-1.5">
              <dt className="font-medium text-sm sm:text-base">{item.question}</dt>
              <dd className="text-muted-foreground text-sm leading-relaxed">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
