import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import { MCP_TOOLS } from '@/lib/product-docs'

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-16 space-y-16">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Dashboard & Tooling
        </h1>
        <p className="text-muted-foreground mt-4 text-lg max-w-3xl">
          Optional tooling on top of the core libraries: Dashboard UI, Atlas tracing, and MCP integration
        </p>
      </header>

      {/* Dashboard */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Dashboard UI</CardTitle>
            <CardDescription className="text-base">
              Web interface for managing scenarios, client lanes, and network traffic
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong className="text-foreground">@sgedda/mockifyer-dashboard</strong> runs locally to manage scenarios, client lanes, 
                network hops, and Date Config. With Redis or SQLite, it proxies traffic so each device/app 
                has its own isolated mock world.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['Active scenario and client lane management', 'Browse and edit JSON mocks for each world', 'Network view: live hops filtered by lane', 'Date Config: per-scenario date overrides', 'Domain-path rules: control which endpoints to record/mock'].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <CodeBlock
              language="bash"
              code={`npx @sgedda/mockifyer-dashboard --path ./mock-data`}
            />
            <Link to="/config-reference">
              <Button variant="outline" size="sm">
                Configuration Reference
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Network */}
      <section id="network">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Network View</CardTitle>
            <CardDescription className="text-base">
              Live HTTP traffic filtered by client lane and scenario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              The dashboard's <strong className="text-foreground">Network</strong> page shows every HTTP request in real-time,
              with filtering by client ID and scenario. View the status, duration, and whether each request was a hit (served from mock) or miss (called the real API).
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {['Filter by client ID to see one device\'s traffic', 'Filter by scenario to isolate a test world', 'Click any request to view full request/response details', 'Export requests as curl commands from the mock editor'].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <CodeBlock
              language="bash"
              code={`# Start the dashboard and navigate to http://localhost:3002/network
npx @sgedda/mockifyer-dashboard --path ./mock-data`}
            />
          </CardContent>
        </Card>
      </section>

      {/* Atlas */}
      <section id="atlas">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Atlas: Live Tracing with the <code className="text-sm">t</code> Key</CardTitle>
            <CardDescription className="text-base">
              Press <code className="text-sm">t</code> in the Metro terminal to capture and visualize nested HTTP calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              When running React Native with Metro, press <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">t</code> to 
              start <strong className="text-foreground">Atlas capture</strong>. A browser opens showing a live stream of correlated, nested 
              HTTP calls as an expandable/collapsible tree: app → BFF → downstream services.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {['View request/response payloads with inline search', 'Find booking data the UI doesn\'t display yet', 'Trace error chains across multiple hops', 'Verify what actually went over the wire', 'Press t again to stop and render searchable HTML docs'].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-foreground">
                <strong>Atlas vs Network view:</strong> <span className="text-muted-foreground">The dashboard's Network tab shows live traffic hop-by-hop. 
                Atlas maps and searches across an entire captured session, generating AI-ready documentation.</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* MCP */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">MCP Integration</CardTitle>
            <CardDescription className="text-base">
              AI tools for Cursor and Claude Desktop
              <span className="inline-flex items-center bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-xs px-2 py-0.5 rounded ml-2">
                Experimental
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">@sgedda/mockifyer-mcp</strong> exposes dashboard APIs to Cursor and Claude Desktop 
              via Model Context Protocol. Tell your AI: "set my lane to trips-empty" or "override booking status to CONFIRMED".
            </p>
            <div>
              <h3 className="font-semibold mb-3">Available MCP Tools</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {MCP_TOOLS.map((tool) => (
                  <li key={tool} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span className="font-mono text-xs">{tool}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
              <h3 className="font-semibold mb-2">MCP Explain Tools</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Two specialized tools help trace response values and diagnose crashes:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span><code className="text-xs bg-muted px-1 py-0.5 rounded border">mockifyer_explain_value</code> — Explains where a response value comes from: which mock file, what overrides modified it (field/date/lane), original vs effective value, and hop chain.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span><code className="text-xs bg-muted px-1 py-0.5 rounded border">mockifyer_explain_incident</code> — Analyzes crashes with preceding network hops and heuristic suspects (weird 200s, GraphQL errors, mock misses).</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Advanced Features */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Response Manipulation</CardTitle>
            <CardDescription className="text-base">
              Override status codes, add delays, and modify field values at replay time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Status Override & Response Delay</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Simulate errors and latency without re-recording. Set <code className="text-xs bg-muted px-1 py-0.5 rounded border">statusOverride</code> (e.g., 500, 429, 404) and <code className="text-xs bg-muted px-1 py-0.5 rounded border">responseDelayMs</code> on any mock via the dashboard or <code className="text-xs bg-muted px-1 py-0.5 rounded border">mockifyer_set_mock_behavior</code> MCP tool.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Field Overrides</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Modify specific response fields without editing the full JSON. Set dot-path overrides (e.g., <code className="text-xs bg-muted px-1 py-0.5 rounded border">trips.0.status = "CONFIRMED"</code>) per mock. Supports replace, extend (merge/append), and remove modes.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Override Groups</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Bundle field overrides across multiple mocks into named groups, then apply the entire group per client lane. Ideal for testing different UI states without duplicating scenarios.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Response Date Overrides</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Automatically shift date fields in responses (e.g., <code className="text-xs bg-muted px-1 py-0.5 rounded border">checkInDate</code>) relative to the per-scenario date config. Keeps test data fresh without re-recording.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Fixture Pool */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Fixture Pool</CardTitle>
            <CardDescription className="text-base">
              Reusable promoted responses with <code className="text-sm">$pool</code> refs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Promote recordings into a shared fixture pool, then reference them from scenario mocks with <code className="text-xs bg-muted px-1 py-0.5 rounded border">$pool</code> refs. 
              Filter arrays by field equality or indices, and apply scenario-specific overrides on top.
            </p>
            <CodeBlock
              language="json"
              code={`{
  "$pool": {
    "id": "trips-list-alice",
    "mode": "document",
    "path": "trips",
    "select": {
      "field": "id",
      "values": ["trip-nyc-checkin"]
    }
  }
}`}
            />
            <p className="text-sm text-muted-foreground">
              See <code className="text-xs bg-muted px-1 py-0.5 rounded border">packages/mockifyer-core/docs/POOL_REFS.md</code> for full syntax.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Hops & Service Chains */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Hops & Service Chains</CardTitle>
            <CardDescription className="text-base">
              Multi-hop request tracing with <code className="text-sm">x-mockifyer-request-id</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mockifyer traces requests across services via <code className="text-xs bg-muted px-1 py-0.5 rounded border">x-mockifyer-request-id</code> headers. 
              View correlated hop chains in Atlas and the dashboard Network view to debug BFF → downstream calls.
            </p>
            <p className="text-sm text-muted-foreground">
              When service B calls service C during a request from A → B, the same request ID propagates, letting you see the full tree.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Scenario Management */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Scenario Management</CardTitle>
            <CardDescription className="text-base">
              Export, import, and backup full scenarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Back up or share entire scenarios (all mocks + date/proxy/domain-path rules) as a single JSON file. 
              Restore on other machines, CI, or after disasters. Use <strong>Settings → Import / export scenario</strong> in the dashboard or the <code className="text-xs bg-muted px-1 py-0.5 rounded border">/api/scenario-config/export</code> endpoint.
            </p>
            <p className="text-sm text-muted-foreground">
              See <code className="text-xs bg-muted px-1 py-0.5 rounded border">packages/mockifyer-dashboard/SCENARIO_IMPORT_EXPORT.md</code> for full API docs.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Recording & Security */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Recording Filters & Redaction</CardTitle>
            <CardDescription className="text-base">
              Exclude endpoints and redact sensitive headers/query params
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Control which requests are recorded and strip sensitive data before saving. Configure <code className="text-xs bg-muted px-1 py-0.5 rounded border">recordingExclusions</code> to skip endpoints, 
              and <code className="text-xs bg-muted px-1 py-0.5 rounded border">redactHeaders</code> / <code className="text-xs bg-muted px-1 py-0.5 rounded border">redactQueryParams</code> to remove API keys, tokens, or PII from recorded mocks.
            </p>
            <p className="text-sm text-muted-foreground">
              See <Link to="/config-reference" className="text-primary hover:underline">Configuration Reference</Link> for full setup details.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Dashboard Auth */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Dashboard Basic Auth</CardTitle>
            <CardDescription className="text-base">
              Password-protect your dashboard with HTTP Basic Authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Secure the dashboard UI with basic auth. Set <code className="text-xs bg-muted px-1 py-0.5 rounded border">MOCKIFYER_DASHBOARD_AUTH_USER</code> and <code className="text-xs bg-muted px-1 py-0.5 rounded border">MOCKIFYER_DASHBOARD_AUTH_PASSWORD</code> environment variables 
              when launching the dashboard. All web requests will require these credentials.
            </p>
            <CodeBlock
              language="bash"
              code={`MOCKIFYER_DASHBOARD_AUTH_USER=admin MOCKIFYER_DASHBOARD_AUTH_PASSWORD=secret123 \\
  npx @sgedda/mockifyer-dashboard --path ./mock-data`}
            />
          </CardContent>
        </Card>
      </section>

      {/* Redis & Storage */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Redis & Disk Mirror</CardTitle>
            <CardDescription className="text-base">
              Optional Redis provider with filesystem fallback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use <code className="text-xs bg-muted px-1 py-0.5 rounded border">--provider redis</code> for multi-device lane isolation with shared state. 
              Mocks are stored by content hash in Redis. The disk mirror option writes mocks to the filesystem as a backup while Redis remains the source of truth.
            </p>
            <CodeBlock
              language="bash"
              code={`npx @sgedda/mockifyer-dashboard --provider redis --redis-url redis://localhost:6379`}
            />
          </CardContent>
        </Card>
      </section>

      {/* React Native Error Boundary */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">MockifyerErrorBoundary</CardTitle>
            <CardDescription className="text-base">
              Crash forensics with network context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wrap your React Native app with <code className="text-xs bg-muted px-1 py-0.5 rounded border">MockifyerErrorBoundary</code> to capture crashes alongside recent HTTP traffic. 
              View the error stack plus network hops in the dashboard to diagnose why the app crashed after a bad response.
            </p>
            <CodeBlock
              language="tsx"
              code={`import { MockifyerErrorBoundary } from '@sgedda/mockifyer-core/react';

<MockifyerErrorBoundary>
  <App />
</MockifyerErrorBoundary>`}
            />
          </CardContent>
        </Card>
      </section>

      {/* Android Support */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Android Emulator & E2E CI</CardTitle>
            <CardDescription className="text-base">
              Full support for Android emulators with automated CI tests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mockifyer works on Android emulators with automatic <code className="text-xs bg-muted px-1 py-0.5 rounded border">10.0.2.2</code> loopback rewriting for localhost APIs. 
              The repo includes a full Android E2E CI workflow (<code className="text-xs bg-muted px-1 py-0.5 rounded border">.github/workflows/e2e-android.yml</code>) 
              that drives the WanderWeird debug APK with Maestro and validates dashboard interactions.
            </p>
            <p className="text-sm text-muted-foreground">
              See <a href="https://github.com/sgedda/mockifyer/pull/492" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">PR #492</a> for the full Android E2E implementation.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Next Steps */}
      <section className="border-t border-border pt-12">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Get Started</CardTitle>
            <CardDescription className="text-base">
              Install and configure dashboard tooling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link to="/getting-started" className="p-4 rounded-lg border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <h3 className="font-semibold mb-2">Installation Guide</h3>
                <p className="text-sm text-muted-foreground">Step-by-step setup instructions</p>
              </Link>
              <Link to="/config-reference" className="p-4 rounded-lg border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <h3 className="font-semibold mb-2">Configuration</h3>
                <p className="text-sm text-muted-foreground">Dashboard settings and options</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
