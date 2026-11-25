import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Github,
  ArrowRight,
  PlayCircle,
  Database,
  Construction,
  Target,
  Zap,
  Smartphone,
  Terminal,
  Map,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import {
  ATLAS_FROM_PLAYWRIGHT_HREF,
  WANDERWEIRD_ATLAS_HREF,
  WANDERWEIRD_ATLAS_SHOWCASE,
} from '@/lib/seo-config'

const StartPageMockGenerator = lazy(() => import('@/components/StartPageMockGenerator'))

const STACKBLITZ_QUICKSTART_URL =
  'https://stackblitz.com/github/sgedda/mockifyer/tree/main/examples/stackblitz-quickstart'

const NODE_SETUP = `import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  recordNewMocksAsPassthrough: true,
  recordResponses: false,
  useGlobalAxios: true,
});

import axios from 'axios';`

const RN_SETUP = `import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';
import { getCurrentDate } from '@sgedda/mockifyer-core';

await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
});

// Read time via getCurrentDate() — Mockifyer doesn't patch global Date
const now = getCurrentDate();`

interface MediaItem {
  src: string
  poster?: string
  caption: string
}

export default function Introduction() {
  const [selectedMedia, setSelectedMedia] = useState(0)

  const mediaItems: MediaItem[] = [
    {
      src: '/videos/e2e-tutorial/delay-and-status-override_b200.mp4',
      poster: '/videos/e2e-tutorial/delay-and-status-override_cc36.jpg',
      caption: 'Override delays and HTTP status codes per scenario',
    },
    {
      src: '/videos/e2e-tutorial/mock-editor-body-edit_7064.mp4',
      poster: '/videos/e2e-tutorial/mock-editor-body-edit_bd79.jpg',
      caption: 'Edit mock response bodies in real-time',
    },
    {
      src: '/videos/e2e-tutorial/header-scenario-picker_4de8.mp4',
      poster: '/videos/e2e-tutorial/header-scenario-picker_bdbe.jpg',
      caption: 'Switch scenarios to test different states',
    },
  ]

  return (
    <div className="space-y-0">
      {/* 1. Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,.12),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

        <div className="relative mx-auto max-w-[1200px] px-5 py-16 sm:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Open-source API record &amp; replay for Node, React Native &amp; Expo
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              <span className="inline-block">Record real APIs.</span>{' '}
              <span className="inline-block bg-gradient-to-r from-primary via-blue-500 to-violet-500 bg-clip-text text-transparent animate-gradient pb-2 leading-normal">
                Replay them anywhere.
              </span>
            </h1>

            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Record real traffic from fetch, axios and React Native, then manage it: switch scenarios
              in a dashboard, catch API drift, and run stable offline E2E. No account, no cloud—mocks
              are JSON in your repo.
            </p>

            <div className="mt-10 max-w-2xl mx-auto">
              <div className="text-center mb-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Get started in 2 minutes
                </span>
              </div>
              <CodeBlock
                language="bash"
                code="npx -p @sgedda/mockifyer-core mockifyer try"
                className="border-2 border-primary/20"
              />
              <p className="text-center text-sm text-muted-foreground mt-3">
                Self-contained demo: records one call, replays it with the network blocked (~10
                seconds)
              </p>
              <div className="mt-4 flex justify-center">
                <a href={STACKBLITZ_QUICKSTART_URL} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="font-medium">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in StackBlitz
                  </Button>
                </a>
              </div>
            </div>

            <div className="mt-6 max-w-[640px] mx-auto">
              <div className="rounded-lg overflow-hidden border border-border/50 shadow-lg">
                <div className="bg-zinc-800 px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-xs text-zinc-400 ml-2">terminal</span>
                </div>
                <div className="bg-zinc-950 px-4 py-3 font-mono text-sm text-left overflow-x-auto">
                  <div className="text-zinc-500 mb-3">$ npx mockifyer try</div>
                  <div className="space-y-1.5">
                    <div className="text-green-400">✓ Recorded GET /hello</div>
                    <div className="text-zinc-400 ml-4 text-xs">
                      Response: {`{"message":"Hello from Mockifyer!"}`}
                    </div>
                    <div className="text-green-400 mt-2">
                      ✓ Server stopped <span className="text-zinc-600">(network unavailable)</span>
                    </div>
                    <div className="text-green-400 mt-2">✓ Replayed from mock — 0 network calls</div>
                    <div className="text-zinc-400 ml-4 text-xs">
                      Response: {`{"message":"Hello from Mockifyer!"}`}
                    </div>
                    <div className="text-green-400 mt-2">✓ Same response, served from mock</div>
                    <div className="text-zinc-500 mt-3">Next: npx mockifyer init</div>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3 italic">
                Same response, no network. That&apos;s the whole idea.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Problems + use cases — one section, four cards */}
      <section
        className="mx-auto max-w-[1200px] px-5 py-20 border-b border-border"
        data-testid="problems-section"
        aria-labelledby="problems-heading"
      >
        <h2 id="problems-heading" className="text-3xl font-semibold tracking-tight text-center mb-4">
          Problems Mockifyer solves
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Build and test against real API shapes without waiting on backends, flakes, or fragile live
          data.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl border border-border bg-card">
            <Construction className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">API isn&apos;t ready yet</h3>
            <p className="text-sm text-muted-foreground">
              Backend is still being built but you need to ship the frontend now—record a sample once,
              then develop against stable mocks.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <Target className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Hard-to-reproduce states</h3>
            <p className="text-sm text-muted-foreground">
              Errors, empty lists, slowness, or a fixed date you can&apos;t force in a live API—switch
              scenarios in the dashboard.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <Zap className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Deterministic offline E2E</h3>
            <p className="text-sm text-muted-foreground">
              Live APIs change and dates drift. Lock a mock world for Maestro and Playwright so the
              same state runs every time—no flakes, no network.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <Smartphone className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">React Native &amp; Expo</h3>
            <p className="text-sm text-muted-foreground">
              Record and replay on device or simulator. Switch scenarios from your dev menu and keep
              mocks as JSON in the repo.
            </p>
          </div>
        </div>
      </section>

      {/* 3. How it works + setup code */}
      <section
        id="setup"
        className="border-b border-border bg-muted/30"
        data-testid="how-it-works-section"
        aria-labelledby="how-it-works-heading"
      >
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <h2
            id="how-it-works-heading"
            className="text-3xl font-semibold tracking-tight text-center mb-12"
          >
            How it works
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-14">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <Terminal className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Initialize</h3>
              <p className="text-sm text-muted-foreground">
                Run{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">
                  npx mockifyer init
                </code>
                . Detects axios/fetch/React Native and writes selective recording defaults. Requests
                land as stubs in{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">
                  _scratch/
                </code>{' '}
                and keep hitting the live API.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <Database className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. Activate mocks</h3>
              <p className="text-sm text-muted-foreground">
                Launch{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">
                  npx mockifyer-dashboard
                </code>
                . Browse recorded requests, activate the ones you want to mock, edit responses, and
                create scenarios.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <PlayCircle className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Replay in tests</h3>
              <p className="text-sm text-muted-foreground">
                Lock the scenario with launch arguments (React Native),{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">
                  MOCKIFYER_SCENARIO
                </code>
                , or a client-id header—same state every run.
              </p>
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            <h3 className="text-xl font-semibold tracking-tight mb-2 text-center">
              Setup in 30 seconds
            </h3>
            <p className="text-muted-foreground mb-6 text-center text-sm">
              Add one setup call at app startup. That&apos;s it.
            </p>

            <Tabs defaultValue="node" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
                <TabsTrigger value="node" data-testid="setup-tab-node">
                  Node
                </TabsTrigger>
                <TabsTrigger value="react-native" data-testid="setup-tab-rn">
                  React Native
                </TabsTrigger>
              </TabsList>
              <TabsContent value="node" className="mt-4">
                <CodeBlock language="typescript" code={NODE_SETUP} />
              </TabsContent>
              <TabsContent value="react-native" className="mt-4">
                <CodeBlock language="typescript" code={RN_SETUP} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* 4. See it in action */}
      <section
        className="mx-auto max-w-[1200px] px-5 py-16 border-b border-border"
        data-testid="see-it-in-action"
        aria-labelledby="see-it-heading"
      >
        <div className="text-center mb-8">
          <h2 id="see-it-heading" className="text-3xl font-semibold tracking-tight mb-3">
            See it in action
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Record traffic, edit mocks in the dashboard, and control delay/status for every scenario
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            Want to try it yourself? Check out the{' '}
            <a
              href="https://github.com/sgedda/mockifyer/tree/main/example-projects/wanderweird-travel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              WanderWeird demo app
            </a>
            {' '}
            — a full-stack Expo + multi-service example.{' '}
            <Link to="/e2e-tutorial" className="text-primary hover:underline font-medium">
              E2E Tutorial →
            </Link>
          </p>
        </div>

        <div className="max-w-4xl mx-auto rounded-xl border border-border bg-card overflow-hidden">
          <video
            key={mediaItems[selectedMedia].src}
            src={mediaItems[selectedMedia].src}
            poster={mediaItems[selectedMedia].poster}
            autoPlay
            muted
            loop
            playsInline
            className="w-full"
            style={{ aspectRatio: '1662/800' }}
          >
            Your browser doesn&apos;t support video playback.
          </video>
          <div className="p-4 text-center text-muted-foreground">
            {mediaItems[selectedMedia].caption}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6 max-w-4xl mx-auto">
          {mediaItems.map((item, index) => (
            <button
              key={item.src}
              type="button"
              onClick={() => setSelectedMedia(index)}
              aria-pressed={selectedMedia === index}
              className={`rounded-lg border overflow-hidden transition-all ${
                selectedMedia === index
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <video
                src={item.src}
                poster={item.poster}
                muted
                playsInline
                preload="metadata"
                className="w-full"
              />
              <div
                className={`p-3 text-xs text-center ${
                  selectedMedia === index ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}
              >
                {item.caption}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 5. Atlas showcase */}
      <section
        id="atlas-showcase"
        className="mx-auto max-w-[1200px] px-5 py-16 border-b border-border"
        aria-labelledby="atlas-showcase-heading"
      >
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-3">
              <Map className="h-4 w-4" aria-hidden="true" />
              Mockifyer Atlas
            </div>
            <h2 id="atlas-showcase-heading" className="text-3xl font-semibold tracking-tight mb-4">
              See what Mockifyer sees
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Generated automatically from {WANDERWEIRD_ATLAS_SHOWCASE.totalRequests} requests in our
              Playwright E2E suite against the WanderWeird demo app. Mockifyer recorded the traffic
              during the tests, then built this Atlas as a test artifact — endpoints, multi-hop flows,
              and mocked vs live calls.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Secrets scrubbed. Light-mode interactive map. Run date{' '}
              {WANDERWEIRD_ATLAS_SHOWCASE.runDate}.
            </p>

            <ol
              className="mb-6 grid gap-3 sm:grid-cols-3 text-left"
              aria-label="How Atlas is produced from Playwright"
            >
              <li className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs font-semibold text-primary mb-1">1. Run Playwright</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Run your Playwright tests with Mockifyer recording on the app under test.
                </p>
              </li>
              <li className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs font-semibold text-primary mb-1">2. Traffic is recorded</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hops land in the dashboard network log while the suite exercises real flows.
                </p>
              </li>
              <li className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs font-semibold text-primary mb-1">3. Atlas artifact (CI)</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Global teardown builds Atlas HTML; GitHub Actions uploads it every run.
                </p>
              </li>
            </ol>

            <div className="flex flex-wrap gap-3">
              <a href={WANDERWEIRD_ATLAS_HREF} className="inline-flex">
                <Button size="lg" className="h-11 px-6 font-medium group">
                  Open full Atlas
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <Link to={ATLAS_FROM_PLAYWRIGHT_HREF} className="inline-flex">
                <Button size="lg" variant="outline" className="h-11 px-6 font-medium">
                  How to automate this
                </Button>
              </Link>
            </div>
          </div>

          <a
            href={WANDERWEIRD_ATLAS_HREF}
            className="order-1 lg:order-2 block rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Open the interactive WanderWeird Atlas"
          >
            <img
              src="/atlas/wanderweird/preview.jpg"
              alt="WanderWeird Atlas overview: 21 observed endpoints, 1205 requests, and a system diagram of mocked vs live hosts"
              width={1600}
              height={617}
              loading="lazy"
              decoding="async"
              className="w-full h-auto"
            />
          </a>
        </div>
      </section>

      {/* 6. HAR / MSW comparison */}
      <section
        className="mx-auto max-w-[1200px] px-5 py-16 border-b border-border"
        data-testid="comparison-section"
        aria-labelledby="comparison-heading"
      >
        <h2
          id="comparison-heading"
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-6"
        >
          How is this different from HAR or MSW?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-sm mb-2">Playwright HAR</h3>
            <p className="text-xs text-muted-foreground">
              Replays recorded traffic, but only inside Playwright browser tests.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-sm mb-2">MSW</h3>
            <p className="text-xs text-muted-foreground">
              Great interception, but you write every handler by hand.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-primary/50 bg-primary/5">
            <h3 className="font-semibold text-sm mb-2 text-primary">Mockifyer</h3>
            <p className="text-xs text-muted-foreground">
              Records from your real app and replays everywhere it runs: dev mode, React Native on a
              device, demos and E2E. Manage it in a dashboard, with drift checks.
            </p>
          </div>
        </div>
        <div className="mt-6 text-center">
          <Link
            to="/comparisons"
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            Full comparisons
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* 7. Free tools — mock data generator teaser */}
      <Suspense
        fallback={
          <section
            className="mx-auto max-w-[1200px] px-5 py-16 border-b border-border"
            aria-busy="true"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading free tools…
            </div>
          </section>
        }
      >
        <StartPageMockGenerator />
      </Suspense>

      {/* 9. Get started CTA (FAQ skipped — duplicates MSW comparison above) */}
      <section
        className="mx-auto max-w-[1200px] px-5 py-20 text-center"
        data-testid="get-started-cta"
      >
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Ready to get started?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Install Mockifyer and start building deterministic tests in minutes. No account required, no
          cloud service—everything runs locally.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/getting-started">
            <Button size="lg" className="h-12 px-8 text-base font-medium">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/e2e-tutorial">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
              <PlayCircle className="mr-2 h-5 w-5" />
              E2E Tutorial
            </Button>
          </Link>
          <a href="https://github.com/sgedda/mockifyer" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
              <Github className="mr-2 h-5 w-5" />
              GitHub
            </Button>
          </a>
        </div>
      </section>
    </div>
  )
}
