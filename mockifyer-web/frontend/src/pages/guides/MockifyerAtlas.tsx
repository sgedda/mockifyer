import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, Network, Eye, Terminal } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import QuickStartBox from '@/components/QuickStartBox'

export default function MockifyerAtlas() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" id="mockifyer-atlas">
          Visualize Your Architecture with Mockifyer Atlas
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Atlas generates an interactive traffic map from recorded HTTP hops — see which hosts your app calls, 
          follow request chains, and search request/response bodies. No instrumentation required; just run your app.
        </p>
      </header>

      <QuickStartBox variant="node-fetch" />

      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md mb-6">
        <p className="text-sm text-muted-foreground">
          <strong>New to Mockifyer?</strong> Start with <Link to="/getting-started" className="text-primary hover:underline">Getting Started</Link> to set up recording. 
          Atlas works best after you've captured real traffic.
        </p>
      </div>

      <div className="p-4 border border-blue-500/50 bg-blue-500/10 rounded-md">
        <p className="text-blue-900 dark:text-blue-200 text-sm">
          <strong>Try it live:</strong> View the{' '}
          <a 
            href="https://sgedda.github.io/mockifyer/atlas/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            WanderWeird Atlas
          </a>
          {' '}generated from the example app's recorded traffic (available from{' '}
          <code className="bg-muted px-1 py-0.5 rounded">@sgedda/mockifyer-core</code> ≥1.10.196).
        </p>
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-xl">
            <Network className="inline-block h-5 w-5 mr-2 mb-1" />
            What Atlas Shows You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                1
              </div>
              <div>
                <strong className="text-foreground">Hosts and services:</strong> Every external host your app contacted, 
                grouped by domain (e.g., <code className="bg-muted px-1 rounded">api.wanderweird.dev</code>, 
                <code className="bg-muted px-1 rounded">weather-api.rapidapi.com</code>).
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                2
              </div>
              <div>
                <strong className="text-foreground">Request edges:</strong> Solid arrows show HTTP calls your app made. 
                Click an edge to see method, path, status, and timing.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                3
              </div>
              <div>
                <strong className="text-foreground">Inferred edges (dashed lines):</strong> When a backend service calls another 
                host but that hop wasn't recorded, Atlas draws a dashed edge labeled{' '}
                <code className="bg-muted px-1 rounded text-xs">caller not recorded</code>. 
                Useful when you're tracing partial multi-service flows.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                4
              </div>
              <div>
                <strong className="text-foreground">Detail pane:</strong> Select a host or edge to see request/response 
                snippets, headers, and correlation IDs.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                5
              </div>
              <div>
                <strong className="text-foreground">Body search:</strong> Type a keyword (e.g., <code className="bg-muted px-1 rounded">Paris</code>) 
                to highlight all requests or responses that mention it. Great for finding where specific data flows.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section id="why-atlas">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Why Visualize Traffic?</h2>
        
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="mb-4">
                When you're debugging a mobile app or a multi-service backend, knowing <em>what</em> was called is only half the picture. 
                Atlas answers:
              </p>
              
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li><strong>Which services talk to each other?</strong> See the full dependency graph.</li>
                <li><strong>Where does this field come from?</strong> Search for a value, find the upstream response.</li>
                <li><strong>Is this backend call real or mocked?</strong> Status and timing tell the story.</li>
                <li><strong>Which requests are slow?</strong> Sort by duration, spot bottlenecks.</li>
              </ul>

              <p className="text-muted-foreground text-sm mt-4">
                Atlas works without code changes. Just record traffic (Mockifyer does this already), then run{' '}
                <code className="bg-muted px-1 rounded">mockifyer-atlas</code>.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="cli-usage">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          <Terminal className="inline-block h-7 w-7 mr-2 mb-1" />
          CLI: Interactive Stream and HTML Export
        </h2>
        
        <p className="text-muted-foreground mb-4">
          The <code className="bg-muted px-1 rounded">mockifyer-atlas</code> CLI ships in{' '}
          <code className="bg-muted px-1 rounded">@sgedda/mockifyer-core</code> ≥1.10.196. 
          It connects to Metro's live hop buffer (for React Native apps) or reads saved hop JSON.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Interactive Terminal Stream (React Native + Metro)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When your Expo or React Native app runs with Metro, Mockifyer streams hops to{' '}
              <code className="bg-muted px-1 rounded">http://localhost:8081/mockifyer-network-events</code>. 
              The Atlas CLI reads that stream and displays nested call trees in your terminal.
            </p>

            <CodeBlock language="bash" code={`# Install mockifyer-core in your project first:
npm install --save-dev @sgedda/mockifyer-core

# Default: Metro on port 8081
mockifyer-atlas

# Custom port
mockifyer-atlas --port 8090

# Plain text (no colors)
mockifyer-atlas --no-color

# Or run without installing (using -p flag):
npx -p @sgedda/mockifyer-core mockifyer-atlas`} />

            <div>
              <h4 className="font-semibold mb-2 text-sm">Interactive Keys</h4>
              <div className="text-xs text-muted-foreground space-y-1 font-mono">
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">click</kbd> — Expand/collapse nested requests (mouse reporting)</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">e</kbd> — Expand/collapse all</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">p</kbd> or <kbd className="bg-muted px-1 py-0.5 rounded border">Space</kbd> — Pause/resume live stream</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">↑</kbd> <kbd className="bg-muted px-1 py-0.5 rounded border">↓</kbd> <kbd className="bg-muted px-1 py-0.5 rounded border">PgUp</kbd> <kbd className="bg-muted px-1 py-0.5 rounded border">PgDn</kbd> — Scroll history (pauses stream)</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">m</kbd> — Toggle mouse (on = click/wheel; off = select/copy)</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">f</kbd> — Filter errors only</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">a</kbd> — Analyze buffer (counts, slow requests, errors)</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">s</kbd> — Snapshot hops → <code className="bg-muted px-1 rounded">mock-data/atlas-html/atlas-events.json</code></div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">r</kbd> — Generate Atlas HTML → <code className="bg-muted px-1 rounded">atlas-html/index.html</code></div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">o</kbd> — Generate HTML and open it in your browser</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">c</kbd> — Clear Metro hop buffer</div>
                <div><kbd className="bg-muted px-1 py-0.5 rounded border">q</kbd> — Quit</div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Press <kbd className="bg-muted px-1 py-0.5 rounded border text-xs">r</kbd> to render the 
              diagram, then <kbd className="bg-muted px-1 py-0.5 rounded border text-xs">o</kbd> to open it. 
              Or visit <code className="bg-muted px-1 rounded">http://localhost:8081/mockifyer-atlas-live</code> for the 
              web version with expand/collapse.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan: Static Code Analysis for Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The <code className="bg-muted px-1 rounded">scan</code> command analyzes your TypeScript/JavaScript source 
              to discover all <code className="bg-muted px-1 rounded">fetch()</code> and{' '}
              <code className="bg-muted px-1 rounded">axios</code> calls. Useful when you want an endpoint inventory 
              before running the app. Requires <code className="bg-muted px-1 rounded">typescript</code> as a dependency.
            </p>

            <CodeBlock language="bash" code={`# Scan ./src for endpoints (requires typescript installed)
mockifyer-atlas scan

# Scan a different directory
mockifyer-atlas scan --dir ./apps/mobile/src

# Save results as JSON
mockifyer-atlas scan --output endpoints.json

# Or without installing (using -p flag):
npx -p @sgedda/mockifyer-core mockifyer-atlas scan`} />

            <div className="text-sm text-muted-foreground">
              <strong>Output:</strong> Grouped by host, each endpoint shows method, URL template, and source file location. 
              Combine with live hop data for a complete view.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate HAR Files for Chrome DevTools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export Atlas hops as HAR 1.2 (HTTP Archive), compatible with Chrome DevTools Network panel, Proxyman, and Charles Proxy.
            </p>

            <CodeBlock language="bash" code={`# From Atlas HTML directory
npx -p @sgedda/mockifyer-core mockifyer-atlas-har --dir ./mock-data/atlas-html

# From a saved events JSON
npx -p @sgedda/mockifyer-core mockifyer-atlas-har --events ./hops.json -o session.har

# If mockifyer-core is installed in your project:
mockifyer-atlas-har --dir ./mock-data/atlas-html`} />

            <div className="text-sm text-muted-foreground">
              <strong>Use case:</strong> Share a HAR with teammates who don't have Mockifyer. They can open it in 
              Chrome DevTools → Network → <em>import HAR file</em>.
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="recording-workflow">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Recording Workflow: Selective by Default</h2>
        
        <p className="text-muted-foreground mb-4">
          Mockifyer's default recording mode is <strong>selective</strong>: new requests land in{' '}
          <code className="bg-muted px-1 rounded">mock-data/_scratch/</code> as request-only stubs. 
          They still hit the live API until you activate them in the dashboard.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Why Selective Recording?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>
                <strong>No noise:</strong> You only mock the 10–30 endpoints that matter for your test scenario. 
                Atlas still sees all traffic; you just don't commit every single request.
              </li>
              <li>
                <strong>Dashboard control:</strong> Browse <code className="bg-muted px-1 rounded">_scratch/</code>, 
                activate the important ones, move them to a named scenario.
              </li>
              <li>
                <strong>Atlas sees everything:</strong> Even request-only stubs appear in the traffic map, so you get 
                the full architecture view without committing gigabytes of mock JSON.
              </li>
            </ul>

            <CodeBlock language="typescript" code={`// Record in selective mode (default)
setupMockifyer({
  recordMode: true,
  mockDataPath: './mock-data',
  recordNewMocksAsPassthrough: true  // New mocks stay on live API
});

// In the dashboard:
// 1. Browse _scratch/
// 2. Activate the endpoints you want to mock
// 3. Move them to a named scenario (e.g., 'default')`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Running Atlas with React Native</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              For React Native apps, Atlas pulls hops from Metro's in-memory buffer. No dashboard required — just run your app and press keys.
            </p>

            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Install dependencies: <code className="bg-muted px-1 rounded">npm install --save-dev @sgedda/mockifyer-core</code></li>
              <li>Start your Expo or React Native app with Metro (<code className="bg-muted px-1 rounded">npx expo start</code>).</li>
              <li>In another terminal: <code className="bg-muted px-1 rounded">mockifyer-atlas</code></li>
              <li>Use the app (navigate, trigger API calls).</li>
              <li>Watch the terminal show nested request chains.</li>
              <li>Press <kbd className="bg-muted px-1 py-0.5 rounded border text-xs">r</kbd> to render HTML, 
                then <kbd className="bg-muted px-1 py-0.5 rounded border text-xs">o</kbd> to open it.</li>
            </ol>

            <p className="text-sm text-muted-foreground mt-3">
              Atlas works best <strong>after</strong> you've recorded traffic. If you haven't yet, run{' '}
              <Link to="/getting-started" className="text-primary hover:underline">Getting Started</Link> first.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="use-cases">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          <Eye className="inline-block h-7 w-7 mr-2 mb-1" />
          When to Use Atlas
        </h2>
        
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Onboarding New Developers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Generate the Atlas diagram, share it with new team members. They see which services exist, what each one calls, 
                and how the data flows—without reading a stale architecture doc.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Debugging Multi-Service Chains</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your mobile app calls Service A, which calls Service B, which calls an external API. 
                Atlas traces the full chain via <code className="bg-muted px-1 rounded">x-mockifyer-request-id</code> headers, 
                even across multiple hops.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Finding Where Data Comes From</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Search for a specific value (e.g., <code className="bg-muted px-1 rounded">temperature: 72</code>). 
                Atlas highlights the upstream request that returned it, so you know which service owns that field.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Code Scan: Pre-Flight Endpoint Discovery</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Run <code className="bg-muted px-1 rounded">mockifyer-atlas scan</code> before recording any traffic. 
                It finds all <code className="bg-muted px-1 rounded">fetch()</code> and{' '}
                <code className="bg-muted px-1 rounded">axios</code> calls in your codebase. 
                Useful for auditing dependencies or planning which endpoints to mock.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Note:</strong> Scan is optional and purely informational. 
                It doesn't record traffic—just reads your source files.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="separate-machines">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Atlas on a Different Machine</h2>
        
        <p className="text-muted-foreground mb-4">
          The dashboard and the React Native app don't need to run on the same machine. Atlas reads from Metro's hop buffer, 
          not from the dashboard. If your app is on a device and Metro is on your laptop, Atlas connects to Metro on your laptop.
        </p>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">Scenario 1:</strong> App on iPhone, Metro on MacBook. 
                Run <code className="bg-muted px-1 rounded">npx mockifyer-atlas</code> on the MacBook. 
                It reads from <code className="bg-muted px-1 rounded">localhost:8081</code>.
              </div>
              <div>
                <strong className="text-foreground">Scenario 2:</strong> Dashboard on a remote server, app on your laptop. 
                Atlas still connects to Metro (where the app is), not the dashboard. 
                The dashboard is for managing scenarios and viewing hops via its web UI.
              </div>
              <div>
                <strong className="text-foreground">Scenario 3:</strong> No Metro. 
                Export hops from the dashboard (<code className="bg-muted px-1 rounded">POST /api/network-events/snapshot</code>), 
                then generate HTML offline.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="cli-availability">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">CLI Availability</h2>
        
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3">
              The <code className="bg-muted px-1 rounded">mockifyer-atlas</code> and{' '}
              <code className="bg-muted px-1 rounded">mockifyer-atlas-har</code> CLIs are available in{' '}
              <code className="bg-muted px-1 rounded">@sgedda/mockifyer-core</code> ≥1.10.196 (now on npm).
            </p>

            <p className="text-sm text-muted-foreground mb-3">
              <strong>Note:</strong> The CLI bins run from compiled JavaScript (no ts-node required) starting with 
              the core release that includes <a href="https://github.com/sgedda/mockifyer/pull/545" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PR #545</a>.
              Install <code className="bg-muted px-1 rounded">@sgedda/mockifyer-core</code> in your project, 
              or use <code className="bg-muted px-1 rounded">npx -p @sgedda/mockifyer-core</code> to run without installing.
            </p>

            <CodeBlock language="bash" code={`# Install in your project (recommended)
npm install --save-dev @sgedda/mockifyer-core

# Check installed version
npm list @sgedda/mockifyer-core

# Upgrade to latest
npm install --save-dev @sgedda/mockifyer-core@latest`} />

            <p className="text-sm text-muted-foreground mt-3">
              The live WanderWeird Atlas at{' '}
              <a 
                href="https://sgedda.github.io/mockifyer/atlas/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://sgedda.github.io/mockifyer/atlas/
              </a>
              {' '}is regenerated nightly by the e2e workflow on the main branch.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="learn-more">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Learn More</h2>
        <div className="grid gap-4">
          <Link to="/getting-started">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-sm text-muted-foreground">
                  Set up Mockifyer and record your first traffic
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/dashboard">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Dashboard and Network View</h3>
                <p className="text-sm text-muted-foreground">
                  Browse scenarios, activate mocks, and view hops in the web UI
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/guides/reproduce-tester-bugs">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Reproduce Tester Bugs</h3>
                <p className="text-sm text-muted-foreground">
                  Trace multi-hop requests and replay bugs locally with correlation IDs
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/e2e-tutorial">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">WanderWeird E2E Tutorial</h3>
                <p className="text-sm text-muted-foreground">
                  Full walkthrough of scenarios, client lanes, and multi-service tracing
                </p>
              </CardContent>
            </Card>
          </Link>

          <a 
            href="https://sgedda.github.io/mockifyer/atlas/" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Live WanderWeird Atlas</h3>
                <p className="text-sm text-muted-foreground">
                  Explore the interactive traffic map from the example app
                </p>
              </CardContent>
            </Card>
          </a>
        </div>
      </section>
    </div>
  )
}
