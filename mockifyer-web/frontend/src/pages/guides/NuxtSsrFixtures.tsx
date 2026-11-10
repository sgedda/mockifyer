import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Server, CheckCircle2 } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function NuxtSsrFixtures() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" id="nuxt-ssr-fixtures">
          Nuxt SSR Fixtures
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Record real backend responses for flaky Nuxt/Nitro CI where Playwright can't intercept server-side fetch
        </p>
      </header>

      <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200 text-sm">
            <strong>The Problem:</strong> Your Nuxt app calls a demo backend in CI. Sometimes it's slow. Sometimes it's down. 
            Playwright can't intercept <code className="bg-muted px-1 rounded">$fetch</code> calls that run server-side during SSR.
          </div>
        </div>
      </div>

      <div className="p-4 border border-blue-500/50 bg-blue-500/10 rounded-md mb-8">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-blue-900 dark:text-blue-200 text-sm">
            <strong>Status:</strong> This guide is based on the proven Next.js App Router pattern (see{' '}
            <code className="bg-muted px-1 rounded">example-projects/nextjs-clerk-example</code>). 
            Nuxt 3/Nitro uses the same <code className="bg-muted px-1 rounded">globalThis.fetch</code> that Mockifyer patches. 
            <strong> No dedicated Nuxt example exists yet</strong>, so test this pattern in your own app before relying on it.
          </div>
        </div>
      </div>

      <section id="the-solution">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">The Solution</h2>
        <p className="text-muted-foreground mb-4">
          Mock at the Node.js layer, not in Playwright. Mockifyer patches <code className="bg-muted px-1 rounded">global.fetch</code> in 
          your Nitro server, so <code className="bg-muted px-1 rounded">$fetch</code> and <code className="bg-muted px-1 rounded">useFetch</code> calls 
          replay from disk during CI.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-red-500/50 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-lg">Flaky: Live Backend in CI</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>✗ Demo backend is slow</p>
              <p>✗ Sometimes returns 500</p>
              <p>✗ Playwright can't intercept SSR fetch</p>
              <p>✗ CI fails unpredictably</p>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Stable: Mocked in Node</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Instant responses
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Same data every run
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Works for SSR fetch
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                CI never waits on backends
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="how-it-works">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">How It Works</h2>
        <p className="text-muted-foreground mb-4">
          Nuxt 3 uses <strong>Nitro</strong> as its server engine. Nitro runs on Node.js and uses <code className="bg-muted px-1 rounded">globalThis.fetch</code> (via 
          <code className="bg-muted px-1 rounded ml-1">ofetch</code>/<code className="bg-muted px-1 rounded">$fetch</code>). 
          Mockifyer patches <code className="bg-muted px-1 rounded">global.fetch</code> at startup, so all server-side HTTP calls replay from disk.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Proven Pattern (Next.js App Router)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The <code className="bg-muted px-1 rounded">example-projects/nextjs-clerk-example</code> shows server-side fetch interception 
              via <code className="bg-muted px-1 rounded">instrumentation.ts</code>:
            </p>
            <CodeBlock language="typescript" code={`// instrumentation.ts (Next.js 15+)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initMockifyerServer } = await import('./lib/mockifyer-server-init');
    await initMockifyerServer();
  }
}

// lib/mockifyer-server-init.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

export async function initMockifyerServer() {
  await setupMockifyer({
    mockDataPath: './mock-data',
    recordMode: process.env.MOCKIFYER_RECORD === 'true'
  });
  
  // Now all fetch() calls in Route Handlers are intercepted
}`} />
            <p className="text-sm text-muted-foreground mt-4">
              This same pattern should work in Nuxt/Nitro, adapted to Nitro's plugin system.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="nuxt-setup">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Nuxt 3 Setup (Proposed)</h2>
        <p className="text-muted-foreground mb-4">
          <strong>Disclaimer:</strong> No official Nuxt example exists yet. This is the expected setup based on Nitro's plugin system 
          and the proven Next.js pattern.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>1. Install Dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="bash" code={`npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch`} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>2. Create a Nitro Plugin</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="typescript" code={`// server/plugins/mockifyer.ts
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

export default defineNitroPlugin(async (nitroApp) => {
  // Only run on server (not during build)
  if (process.env.NODE_ENV !== 'production' || process.env.MOCKIFYER_MODE === 'on') {
    await setupMockifyer({
      mockDataPath: './mock-data',
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
      config: {
        logging: 'info'
      }
    });
    
    console.log('[Mockifyer] Intercepting server-side fetch');
  }
});`} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>3. Record Responses Locally</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="bash" code={`# In development, record real responses
MOCKIFYER_RECORD=true npm run dev

# Visit pages that trigger SSR fetch calls
# Responses are saved to mock-data/default/`} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>4. Replay in CI</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="yaml" code={`# .github/workflows/e2e.yml
- name: Build and test
  run: |
    npm run build
    npm run preview &
    
    # Replay mode (default when MOCKIFYER_RECORD is not set)
    npx playwright test
  env:
    MOCKIFYER_MODE: on  # ensure mocks are active
    # MOCKIFYER_RECORD is not set → replay mode`} />
          </CardContent>
        </Card>
      </section>

      <section id="verify">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">How to Verify It Works</h2>
        <p className="text-muted-foreground mb-4">
          Test that <code className="bg-muted px-1 rounded">$fetch</code> is being intercepted:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Simple Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. Add a debug route</h4>
              <CodeBlock language="typescript" code={`// server/api/test-mock.get.ts
export default defineEventHandler(async (event) => {
  const response = await $fetch('https://jsonplaceholder.typicode.com/posts/1');
  return {
    wasMocked: !!process.env.MOCKIFYER_MODE,
    data: response
  };
});`} />
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Record it</h4>
              <CodeBlock language="bash" code={`MOCKIFYER_RECORD=true npm run dev
curl http://localhost:3000/api/test-mock

# Check mock-data/default/jsonplaceholder.typicode.com_posts_1_GET.json`} />
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Replay it (disconnect network)</h4>
              <CodeBlock language="bash" code={`# Stop recording, restart
MOCKIFYER_MODE=on npm run dev

# Kill your network connection, then:
curl http://localhost:3000/api/test-mock

# If it still returns data, Mockifyer is working!`} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="limitations">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Known Limitations</h2>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h4 className="font-semibold mb-2">No Official Nuxt Example</h4>
              <p className="text-sm text-muted-foreground">
                This guide is based on the Next.js pattern. If you implement it in Nuxt, please share your results or contribute 
                an example to the repo!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h4 className="font-semibold mb-2">Build-Time Fetch Not Supported</h4>
              <p className="text-sm text-muted-foreground">
                Mockifyer intercepts runtime fetch, not build-time fetch (e.g. <code className="bg-muted px-1 rounded">nuxt generate</code> SSG). 
                Use it for SSR pages in <code className="bg-muted px-1 rounded">nuxt build</code> + <code className="bg-muted px-1 rounded">nuxt preview</code> mode.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h4 className="font-semibold mb-2">Client-Side Fetch Requires Separate Setup</h4>
              <p className="text-sm text-muted-foreground">
                This guide covers server-side fetch in Nitro. For client-side fetch interception in the browser, 
                you'd need a different approach (e.g. MSW, or Mockifyer via a service worker — not currently supported).
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="learn-more">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Learn More</h2>
        <div className="grid gap-4">
          <a 
            href="https://github.com/sgedda/mockifyer/tree/main/example-projects/nextjs-clerk-example"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Next.js App Router Example</h3>
                <p className="text-sm text-muted-foreground">
                  Proven server-side fetch interception via instrumentation.ts
                </p>
              </CardContent>
            </Card>
          </a>

          <Link to="/getting-started">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-sm text-muted-foreground">
                  Install Mockifyer and record your first responses
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/guides/mock-drift">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Stop Mock Drift</h3>
                <p className="text-sm text-muted-foreground">
                  Re-record when APIs change and diff to catch breaking changes
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  )
}
