import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Github, ArrowRight, PlayCircle, Database, Code2, Sparkles, Construction, Target, Zap, GitBranch, Terminal, Play, Radio, LayoutDashboard, TrendingUp, CheckCircle2 } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import RunItButton from '@/components/RunItButton'

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
      caption: 'Override delays and HTTP status codes per scenario'
    },
    {
      src: '/videos/e2e-tutorial/mock-editor-body-edit_7064.mp4',
      poster: '/videos/e2e-tutorial/mock-editor-body-edit_bd79.jpg',
      caption: 'Edit mock response bodies in real-time'
    },
    {
      src: '/videos/e2e-tutorial/header-scenario-picker_4de8.mp4',
      poster: '/videos/e2e-tutorial/header-scenario-picker_bdbe.jpg',
      caption: 'Switch scenarios to test different states'
    }
  ]

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,.12),transparent_60%)]"></div>
        <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"></div>
        
        <div className="relative mx-auto max-w-[1200px] px-5 py-16 sm:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
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
              HTTP mock record/replay for JavaScript and React Native. No account, no cloud—mocks are JSON in your repo or your own Redis/SQLite.
            </p>
            
            {/* Try Command CTA */}
            <div className="mt-10 max-w-2xl mx-auto">
              <div className="text-center mb-3">
                <span className="text-sm font-medium text-muted-foreground">Get started in 2 minutes</span>
              </div>
              <div className="relative">
                <CodeBlock
                  language="bash"
                  code="npx -p @sgedda/mockifyer-core mockifyer try"
                  className="border-2 border-primary/20"
                />
              </div>
              <p className="text-center text-sm text-muted-foreground mt-3">
                Self-contained demo: records one call, replays it with the network blocked (~10 seconds)
              </p>
            </div>

            {/* Compact Terminal Output */}
            <div className="mt-6 max-w-[640px] mx-auto">
              <div className="rounded-lg overflow-hidden border border-border/50 shadow-lg">
                {/* Terminal Header */}
                <div className="bg-zinc-800 dark:bg-zinc-900 px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <span className="text-xs text-zinc-400 ml-2">terminal</span>
                </div>
                {/* Terminal Content */}
                <div className="bg-zinc-950 dark:bg-black px-4 py-3 font-mono text-sm text-left overflow-x-auto">
                  <div className="text-zinc-500 dark:text-zinc-600 mb-3">$ npx mockifyer try</div>
                  <div className="space-y-1.5">
                    <div className="text-green-400">✓ Recorded GET /hello</div>
                    <div className="text-zinc-400 dark:text-zinc-500 ml-4 text-xs">Response: {`{"message":"Hello from Mockifyer!"}`}</div>
                    <div className="text-green-400 mt-2">✓ Server stopped <span className="text-zinc-600 dark:text-zinc-700">(network unavailable)</span></div>
                    <div className="text-green-400 mt-2">✓ Replayed from mock — 0 network calls</div>
                    <div className="text-zinc-400 dark:text-zinc-500 ml-4 text-xs">Response: {`{"message":"Hello from Mockifyer!"}`}</div>
                    <div className="text-green-400 mt-2">✓ Same response, served from mock</div>
                    <div className="text-zinc-500 dark:text-zinc-600 mt-3">Next: npx mockifyer init</div>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3 italic">Same response, no network. That's the whole idea.</p>
            </div>

            {/* Feature Tiles */}
            <div className="mt-10 max-w-[1200px] mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link to="/getting-started" className="group">
                  <div className="h-full p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
                    <Radio className="h-5 w-5 text-primary mb-2" />
                    <h3 className="font-semibold text-sm mb-1">Records real app traffic</h3>
                    <p className="text-xs text-muted-foreground mb-2">fetch, axios and React Native, selectively, only what you choose.</p>
                    <span className="text-xs text-primary group-hover:underline inline-flex items-center gap-1">
                      Learn more <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>

                <Link to="/dashboard" className="group">
                  <div className="h-full p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
                    <LayoutDashboard className="h-5 w-5 text-primary mb-2" />
                    <h3 className="font-semibold text-sm mb-1">Dashboard and scenarios</h3>
                    <p className="text-xs text-muted-foreground mb-2">Browse, edit and activate mocks, and switch error, empty and slow scenarios.</p>
                    <span className="text-xs text-primary group-hover:underline inline-flex items-center gap-1">
                      Learn more <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>

                <Link to="/guides/mock-drift" className="group">
                  <div className="h-full p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
                    <TrendingUp className="h-5 w-5 text-primary mb-2" />
                    <h3 className="font-semibold text-sm mb-1">Drift check</h3>
                    <p className="text-xs text-muted-foreground mb-2">Know when the real API changed and your mocks went stale.</p>
                    <span className="text-xs text-primary group-hover:underline inline-flex items-center gap-1">
                      Learn more <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>

                <Link to="/guides/stable-react-native-e2e" className="group">
                  <div className="h-full p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
                    <CheckCircle2 className="h-5 w-5 text-primary mb-2" />
                    <h3 className="font-semibold text-sm mb-1">Stable E2E and CI</h3>
                    <p className="text-xs text-muted-foreground mb-2">Offline, deterministic Maestro and Playwright runs, with mocks as JSON in your repo.</p>
                    <span className="text-xs text-primary group-hover:underline inline-flex items-center gap-1">
                      Learn more <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              </div>
            </div>
            
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/getting-started">
                <Button size="lg" className="h-12 px-8 text-base font-medium group">
                  Quick Start Guide
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/e2e-tutorial">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Full Tutorial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* See It In Action Showcase */}
      <section className="mx-auto max-w-[1200px] px-5 py-16 border-b border-border">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">See It In Action</h2>
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
            {' '}— a full-stack Expo + multi-service example (7 Node services, Umbraco CMS, scenarios, request tracing).{' '}
            <Link to="/e2e-tutorial" className="text-primary hover:underline font-medium">
              E2E Tutorial →
            </Link>
          </p>
        </div>
        
        {/* Main player */}
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
            Your browser doesn't support video playback.
          </video>
          <div className="p-4 text-center text-muted-foreground">
            {mediaItems[selectedMedia].caption}
          </div>
        </div>
        
        {/* Thumbnail gallery */}
        <div className="grid md:grid-cols-3 gap-4 mt-6 max-w-4xl mx-auto">
          {mediaItems.map((item, index) => (
            <button
              key={item.src}
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
              <div className={`p-3 text-xs text-center ${
                selectedMedia === index 
                  ? 'text-primary font-medium' 
                  : 'text-muted-foreground'
              }`}>
                {item.caption}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Problems It Solves */}
      <section className="mx-auto max-w-[1200px] px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-center mb-4">The Problems Mockifyer Solves</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Testing integrations is hard when dependencies aren't stable
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-border bg-card">
            <Construction className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">API Isn't Ready Yet</h3>
            <p className="text-sm text-muted-foreground">
              Backend is still being built but you need to build and test the frontend now
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <Target className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Hard-to-Reproduce States</h3>
            <p className="text-sm text-muted-foreground">
              Errors, slowness, a specific date, or edge cases that you can't easily set up in a live API
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <Zap className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">E2E Tests Flake on Live Data</h3>
            <p className="text-sm text-muted-foreground">
              Real APIs change, data disappears, dates drift—tests that passed yesterday fail today
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <GitBranch className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Trace Requests Across Services</h3>
            <p className="text-sm text-muted-foreground">
              Follow request chains service-to-service via <code className="text-xs bg-muted px-1 py-0.5 rounded">x-mockifyer-request-id</code> headers. See what each hop sent and received.
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <Terminal className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Replicate Any Request with curl</h3>
            <p className="text-sm text-muted-foreground">
              Export recorded requests as copy-paste curl commands. Test backends directly, share reproduction steps.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works - 3 Steps */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-center mb-12">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <Terminal className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Initialize</h3>
              <p className="text-sm text-muted-foreground">
                Run <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">npx mockifyer init</code>. Detects axios/fetch/React Native, writes config with selective recording defaults. Requests land as request-only stubs in <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">_scratch/</code> and keep hitting the live API.
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <Database className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. Activate Mocks</h3>
              <p className="text-sm text-muted-foreground">
                Launch <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">npx mockifyer-dashboard</code>. Browse recorded requests, activate the ones you want to mock (untick "Always use live API"), edit responses, and create scenarios.
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <PlayCircle className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Replay in Tests</h3>
              <p className="text-sm text-muted-foreground">
                Lock the scenario with launch arguments (React Native), <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">MOCKIFYER_SCENARIO</code> (Node), or <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">x-mockifyer-client-id</code> header (per-lane)—same state every run.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section id="date-freezing" className="mx-auto max-w-[1200px] px-5 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">Setup in 30 Seconds</h2>
          <p className="text-muted-foreground mb-8">
            Add one setup call at app startup. That's it.
          </p>
          
          <CodeBlock
            language="typescript"
            code={`import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';
import { getCurrentDate } from '@sgedda/mockifyer-core';

await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  config: {
    dateManipulation: {
      fixedDate: '2024-12-20',
      timezone: 'America/New_York'
    }
  }
});

// Read time via getCurrentDate() — Mockifyer doesn't patch global Date
const now = getCurrentDate();`}
          />
          
          <div className="mt-8 p-5 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3 mb-4">
              <Play className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Try it Live</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Record API calls, replay them offline, switch scenarios (empty/error), and freeze dates—all in your browser.
                </p>
              </div>
            </div>
            <RunItButton 
              project="record-replay-basics"
              title="Run Demo in StackBlitz"
              size="sm"
            />
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-center mb-12">Use Cases</h2>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-xl border border-border bg-card">
              <Code2 className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">React Native Development</h3>
              <p className="text-sm text-muted-foreground">
                Develop mobile apps with consistent mock data. Switch scenarios from your dev menu, test edge cases, and work offline.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-border bg-card">
              <PlayCircle className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Deterministic E2E Tests</h3>
              <p className="text-sm text-muted-foreground">
                Lock the mock world with launch arguments. Same state every run—no flakes, no external dependencies.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-border bg-card">
              <Database className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Demos & Presentations</h3>
              <p className="text-sm text-muted-foreground">
                Show your app with perfect data every time. No network issues, no unexpected responses during the demo.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-border bg-card">
              <Sparkles className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">AI Agents via MCP</h3>
              <p className="text-sm text-muted-foreground">
                Connect Cursor or Claude to your dashboard. AI can search mocks, set scenarios, and override field values. <strong>Not on npm</strong>—local tooling only.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Ready to Get Started?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Install Mockifyer and start building deterministic tests in minutes. No account required, no cloud service—everything runs locally.
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
