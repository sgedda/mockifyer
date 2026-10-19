import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'

interface ComparisonTool {
  name: string
  github: string
  description: string
  whenToChoose: string
}

const alternatives: ComparisonTool[] = [
  {
    name: 'MSW (Mock Service Worker)',
    github: 'https://github.com/mswjs/msw',
    description: 'API mocking library using Service Worker API in browsers and socket-level interception in Node.js.',
    whenToChoose: 'When you need browser-based mocking with Service Workers, or want to write handlers once for development, testing, and Storybook. Strong choice for React/frontend-heavy projects that don\'t need JSON file recordings.',
  },
  {
    name: 'Polly.js',
    github: 'https://github.com/Netflix/pollyjs',
    description: 'Netflix\'s framework-agnostic HTTP recording, replay, and stubbing library for Node and browser tests.',
    whenToChoose: 'When you need framework-agnostic recording/replay with disk or local-storage persistence, event hooks, and Mocha/QUnit integration. Good for teams already using Netflix tooling or needing time control in tests.',
  },
  {
    name: 'Nock',
    github: 'https://github.com/nock/nock',
    description: 'HTTP server mocking and expectations library for Node.js that overrides http.request.',
    whenToChoose: 'When you need Node.js-only test mocking with a simple API, no file storage required. Ideal for unit tests where you define expected requests/responses in code rather than committed recordings.',
  },
  {
    name: 'Mirage JS',
    github: 'https://github.com/miragejs/miragejs',
    description: 'Client-side server with an ORM, factories, fixtures, and serializers for rich API simulation.',
    whenToChoose: 'When you want a full in-memory fake backend with models, relationships, and serializers. Best for prototyping frontend apps with complex data structures before the real API exists.',
  },
  {
    name: 'WireMock',
    github: 'https://github.com/wiremock/wiremock',
    description: 'Java-based HTTP mock server with rich request matching, response templating, record/playback, and fault injection.',
    whenToChoose: 'When you need a standalone mock server (not embedded in your app), especially in JVM ecosystems. Supports advanced features like stateful scenarios, WebSocket mocking, and can run as a service.',
  },
  {
    name: 'Mockoon',
    github: 'https://github.com/mockoon/mockoon',
    description: 'Open-source API mocking tool with desktop app, CLI, and Docker image. Supports CRUD routes, dynamic templating, OpenAPI import, and proxying.',
    whenToChoose: 'When you want a GUI desktop app to design mock APIs with point-and-click, or need stateful CRUD operations on fake databases. Good for teams who prefer visual tools over code-first mocking.',
  },
  {
    name: 'json-server',
    github: 'https://github.com/typicode/json-server',
    description: 'Generates a full REST API from a JSON file with CRUD endpoints, filtering, sorting, pagination, and relationships.',
    whenToChoose: 'When you need a quick zero-code REST API for prototyping with a single JSON file. Perfect for demos and learning, but lacks advanced features like scenarios, date control, or recording from real APIs.',
  },
]

const featureMatrix: {
  feature: string
  mockifyer: boolean | string
  msw: boolean | string
  polly: boolean | string
  nock: boolean | string
  mirage: boolean | string
  wiremock: boolean | string
  mockoon: boolean | string
  jsonServer: boolean | string
}[] = [
  {
    feature: 'In-app record from real APIs',
    mockifyer: true,
    msw: false,
    polly: true,
    nock: false,
    mirage: false,
    wiremock: true,
    mockoon: true,
    jsonServer: false,
  },
  {
    feature: 'JSON recordings in repo',
    mockifyer: true,
    msw: false,
    polly: 'Disk/localStorage',
    nock: false,
    mirage: false,
    wiremock: 'JSON files',
    mockoon: 'JSON/OpenAPI',
    jsonServer: 'Single JSON',
  },
  {
    feature: 'Scenarios (switchable worlds)',
    mockifyer: true,
    msw: false,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: 'Stateful',
    mockoon: false,
    jsonServer: false,
  },
  {
    feature: 'Client lanes (multi-user isolation)',
    mockifyer: 'Redis/SQLite',
    msw: false,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: false,
    mockoon: false,
    jsonServer: false,
  },
  {
    feature: 'Axios support',
    mockifyer: true,
    msw: true,
    polly: true,
    nock: 'http module',
    mirage: true,
    wiremock: 'Any client',
    mockoon: 'Any client',
    jsonServer: 'Any client',
  },
  {
    feature: 'Fetch / React Native',
    mockifyer: 'fetch + RN',
    msw: 'Browser + Node',
    polly: 'Browser + Node',
    nock: false,
    mirage: 'Browser',
    wiremock: 'Any client',
    mockoon: 'Any client',
    jsonServer: 'Any client',
  },
  {
    feature: 'Date/time control',
    mockifyer: true,
    msw: false,
    polly: 'Speed up/slow down',
    nock: false,
    mirage: false,
    wiremock: false,
    mockoon: false,
    jsonServer: false,
  },
  {
    feature: 'GraphQL-aware matching',
    mockifyer: true,
    msw: true,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: 'Extensions',
    mockoon: false,
    jsonServer: false,
  },
  {
    feature: 'Live tracing UI (nested hops)',
    mockifyer: 'Atlas (t key)',
    msw: false,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: 'Admin API',
    mockoon: false,
    jsonServer: false,
  },
  {
    feature: 'Dashboard / UI',
    mockifyer: 'Local web UI',
    msw: false,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: 'Admin API',
    mockoon: 'Desktop + web',
    jsonServer: false,
  },
  {
    feature: 'Deterministic E2E (launch args)',
    mockifyer: 'Maestro',
    msw: false,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: false,
    mockoon: false,
    jsonServer: false,
  },
  {
    feature: 'Runtime toggle (opt-in/out)',
    mockifyer: true,
    msw: false,
    polly: false,
    nock: false,
    mirage: 'Passthrough',
    wiremock: false,
    mockoon: false,
    jsonServer: false,
  },
  {
    feature: 'AI integration (MCP)',
    mockifyer: 'Experimental',
    msw: false,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: false,
    mockoon: false,
    jsonServer: false,
  },
]

const packages = [
  {
    name: '@sgedda/mockifyer-core',
    description: 'Mocks, scenarios, client lanes, date control, providers',
  },
  {
    name: '@sgedda/mockifyer-fetch',
    description: 'fetch, React Native, Metro sync, Atlas tracing (t key)',
  },
  {
    name: '@sgedda/mockifyer-axios',
    description: 'Axios integration for Node and backend services',
  },
  {
    name: '@sgedda/mockifyer-dashboard',
    description: 'Web UI, Redis/SQLite, Network view, scenario/lane management',
  },
  {
    name: '@sgedda/mockifyer-mcp',
    description: 'AI tools for Cursor and Claude (experimental)',
  },
]

export default function Comparisons() {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold mb-4">Mockifyer vs Alternatives</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          A fair comparison of Mockifyer with other API mocking tools, based on official documentation.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>The Problem Mockifyer Solves</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Modern applications depend on many underlying systems — APIs, databases, third-party services. 
            Testing these integrations is challenging:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>
              <strong className="text-foreground">Test data disappears or goes stale:</strong> A booking 
              created for testing yesterday might be expired today, or deleted by another developer
            </li>
            <li>
              <strong className="text-foreground">Dates drift:</strong> Time-dependent logic like "upcoming trips" 
              or "check-in window" breaks as calendar dates move forward
            </li>
            <li>
              <strong className="text-foreground">State setup takes manual work:</strong> Creating the right 
              test state (empty cart, one item, many items, checkout error) requires clicking through admin panels 
              or running database scripts
            </li>
            <li>
              <strong className="text-foreground">Previous fixes were hacky:</strong> Hardcoded backend 
              bypasses tied to one test user, supporting only one dataset at a time
            </li>
          </ul>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Mockifyer gives you deterministic state that doesn&apos;t drift.</strong> Record 
            real API responses once, switch between complete scenarios at runtime, and control dates to keep 
            time-dependent tests stable. No more "works on my machine" — the same mock world loads 
            for everyone.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Comparison</CardTitle>
          <CardDescription>
            Compare Mockifyer&apos;s capabilities with other popular API mocking tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Feature</th>
                  <th className="text-left p-3 font-semibold bg-primary/5">Mockifyer</th>
                  <th className="text-left p-3 font-semibold">MSW</th>
                  <th className="text-left p-3 font-semibold">Polly.js</th>
                  <th className="text-left p-3 font-semibold">Nock</th>
                  <th className="text-left p-3 font-semibold">Mirage</th>
                  <th className="text-left p-3 font-semibold">WireMock</th>
                  <th className="text-left p-3 font-semibold">Mockoon</th>
                  <th className="text-left p-3 font-semibold">json-server</th>
                </tr>
              </thead>
              <tbody>
                {featureMatrix.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-accent/50">
                    <td className="p-3 font-medium">{row.feature}</td>
                    <td className="p-3 bg-primary/5">{renderCell(row.mockifyer)}</td>
                    <td className="p-3">{renderCell(row.msw)}</td>
                    <td className="p-3">{renderCell(row.polly)}</td>
                    <td className="p-3">{renderCell(row.nock)}</td>
                    <td className="p-3">{renderCell(row.mirage)}</td>
                    <td className="p-3">{renderCell(row.wiremock)}</td>
                    <td className="p-3">{renderCell(row.mockoon)}</td>
                    <td className="p-3">{renderCell(row.jsonServer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What Makes Mockifyer Different?</CardTitle>
          <CardDescription>
            Mockifyer&apos;s unique combination of features for real-world development
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">🎭 Scenarios as Switchable &quot;Worlds&quot;</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Instead of managing test data manually, define complete scenarios: <code className="text-xs bg-muted px-1 py-0.5 rounded">trips-empty</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">trips-one</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">trips-many</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">checkin-open</code>. 
                Each scenario is a folder of JSON mocks representing a complete application state.
              </p>
              <p className="text-sm text-muted-foreground">
                Switch scenarios at runtime from the dev section of your React Native app, the dashboard, 
                or environment variables. No code changes, no server restarts — just flip the world 
                you&apos;re testing in.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🔀 Client Lanes (Multi-User Isolation)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Each app instance or device has its own <strong>client ID</strong> (lane). The dashboard 
                manages lane-to-scenario mappings in Redis or SQLite, so your phone can test <code className="text-xs bg-muted px-1 py-0.5 rounded">trips-empty</code> while 
                your colleague tests <code className="text-xs bg-muted px-1 py-0.5 rounded">trips-many</code> — both hitting the same backend services, 
                with no mock conflicts.
              </p>
              <p className="text-sm text-muted-foreground">
                Backend services share the same client ID through request headers, so the entire call 
                chain (app → BFF → microservices) uses the same scenario. Perfect for testing distributed systems.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">📡 Atlas: Live Tracing with the <code className="text-xs bg-muted px-1 py-0.5 rounded">t</code> Key</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Press <code className="text-xs bg-muted px-1 py-0.5 rounded">t</code> in the Metro terminal to start <strong>Atlas capture</strong>. 
                A browser opens showing a live stream of correlated, nested HTTP calls as an 
                expandable/collapsible tree: app → BFF → downstream services.
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Each hop shows request/response payloads with inline search — find booking data the UI 
                doesn&apos;t display yet, trace error chains, or verify what actually went over the wire. Press <code className="text-xs bg-muted px-1 py-0.5 rounded">t</code> again 
                to stop, then render searchable HTML docs from the session.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Atlas vs Network view:</strong> The dashboard&apos;s Network tab shows live traffic hop-by-hop 
                (useful for debugging right now). Atlas maps and searches across an entire captured session, 
                generating AI-ready documentation of your call chains.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">📅 Deterministic Dates</h4>
              <p className="text-sm text-muted-foreground">
                Fix dates, apply offsets, or change timezones across your entire test suite. 
                Call <code className="text-xs bg-muted px-1 py-0.5 rounded">getCurrentDate()</code> instead of <code className="text-xs bg-muted px-1 py-0.5 rounded">new Date()</code> and 
                eliminate flaky time-dependent tests. The date can be configured per scenario in the 
                dashboard, so <code className="text-xs bg-muted px-1 py-0.5 rounded">checkin-open</code> always shows trips with check-in windows starting &quot;today.&quot;
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🎬 Deterministic Maestro E2E</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Launch arguments <code className="text-xs bg-muted px-1 py-0.5 rounded">mockifyerClientId</code> and <code className="text-xs bg-muted px-1 py-0.5 rounded">scenario</code> start 
                the app in the same mock world on every test run. No flaky API dependencies, no race conditions.
              </p>
              <div className="bg-muted/50 p-3 rounded-md">
                <pre className="text-xs overflow-x-auto">
{`- launchApp:
    clearState: true
    arguments:
      mockifyerClientId: e2e-trips-one
      scenario: trips-one`}
                </pre>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Workflow:</strong> Record the real API responses, have an AI write a Maestro test 
                that starts with that scenario, then assert on what the UI components render. Every run 
                replays the exact same backend state.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🎛️ Runtime Toggle (Opt-In, Disabled by Default)</h4>
              <p className="text-sm text-muted-foreground">
                Mockifyer is opt-in and can be completely disabled. Set <code className="text-xs bg-muted px-1 py-0.5 rounded">runtimeMode: &apos;manual&apos;</code> to 
                start with mocks off, then call <code className="text-xs bg-muted px-1 py-0.5 rounded">enableMockifyer()</code> from a dev menu toggle. 
                When disabled, all requests bypass mocks, dashboard, and Redis — zero overhead. Perfect for 
                comparing mock vs. real API behavior during debugging.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🎛️ Dashboard</h4>
              <p className="text-sm text-muted-foreground">
                Local web UI for managing:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 mt-2">
                <li>Active scenario and client lanes</li>
                <li>JSON mocks for each world (view, edit, activate passthrough)</li>
                <li>Network hops filtered by lane</li>
                <li>Date Config per scenario</li>
                <li>Domain-path rules (which endpoints to record/mock)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🤖 MCP for AI Assistants (Experimental)</h4>
              <p className="text-sm text-muted-foreground">
                Connect Cursor or Claude Desktop to the dashboard via Model Context Protocol. Natural 
                language commands like:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 mt-2">
                <li>&quot;Set my lane to trips-empty&quot;</li>
                <li>&quot;Override the booking status to CONFIRMED&quot;</li>
                <li>&quot;Trace the last failing hop&quot;</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-xs px-2 py-0.5 rounded">
                  Early / Experimental
                </span>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">📱 React Native & Metro Sync</h4>
              <p className="text-sm text-muted-foreground">
                Hybrid provider writes mocks to both device storage (Expo FileSystem) and the project 
                repo via Metro HTTP endpoints. Edit a mock in your IDE, reload the app — it syncs 
                automatically. Works with both fetch and axios in React Native.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🔍 GraphQL Query Normalization</h4>
              <p className="text-sm text-muted-foreground">
                Automatically matches GraphQL requests by normalized query + sorted variables, 
                not just operation name. Handles complex queries correctly out of the box.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Support</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Node.js</h4>
              <p className="text-sm text-muted-foreground">
                Full support via <code className="text-xs bg-muted px-1 py-0.5 rounded">@sgedda/mockifyer-axios</code> for 
                backend services and APIs
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">React Native</h4>
              <p className="text-sm text-muted-foreground">
                Native support via <code className="text-xs bg-muted px-1 py-0.5 rounded">@sgedda/mockifyer-fetch</code> with 
                Metro sync and device storage
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">React Web</h4>
              <p className="text-sm text-muted-foreground">
                Browser support via <code className="text-xs bg-muted px-1 py-0.5 rounded">@sgedda/mockifyer-fetch</code> for 
                web applications
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Package Overview</CardTitle>
          <CardDescription>
            Mockifyer is split into focused packages for different use cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div key={pkg.name} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded flex-shrink-0">
                  {pkg.name}
                </code>
                <p className="text-sm text-muted-foreground">{pkg.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {alternatives.map((tool) => (
          <Card key={tool.name}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl">{tool.name}</CardTitle>
                  <CardDescription className="mt-2">{tool.description}</CardDescription>
                </div>
                <a
                  href={tool.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`View ${tool.name} on GitHub`}
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">When to choose {tool.name.replace(' (Mock Service Worker)', '')}</h4>
                <p className="text-sm text-muted-foreground">{tool.whenToChoose}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>When to Choose Mockifyer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Mockifyer is designed for teams who want:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>
              <strong className="text-foreground">Deterministic state that doesn&apos;t drift:</strong> No more 
              stale test data, expired bookings, or broken time-dependent logic
            </li>
            <li>
              <strong className="text-foreground">Scenario-driven development:</strong> Switch between complete 
              application states (empty, one item, many items, errors) at runtime without manual setup
            </li>
            <li>
              <strong className="text-foreground">Multi-user isolation:</strong> Client lanes let each 
              developer or device test different scenarios simultaneously without conflicts
            </li>
            <li>
              <strong className="text-foreground">React Native + Expo:</strong> Full-stack record/replay 
              for mobile apps with automatic Metro sync
            </li>
            <li>
              <strong className="text-foreground">Live tracing & debugging:</strong> Press <code className="text-xs bg-muted px-1 py-0.5 rounded">t</code> to 
              capture and visualize nested call chains across your entire stack
            </li>
            <li>
              <strong className="text-foreground">Deterministic E2E with Maestro:</strong> Launch arguments 
              guarantee the same mock world on every test run
            </li>
            <li>
              <strong className="text-foreground">Committed recordings:</strong> JSON mocks checked into 
              the repo, discoverable in your editor and code review
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            If you need a simple code-first mocking solution without file persistence, 
            consider MSW or Nock. For prototyping with an in-memory ORM, Mirage JS excels. 
            For JVM ecosystems or standalone mock servers, WireMock is battle-tested. 
            For GUI-driven mocking, Mockoon offers a polished desktop experience.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function renderCell(value: boolean | string): React.ReactNode {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="text-green-600 dark:text-green-400">✓</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    )
  }
  return <span className="text-xs">{value}</span>
}
