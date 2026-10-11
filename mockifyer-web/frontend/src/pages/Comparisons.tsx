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
    feature: 'Scenario switching',
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
    feature: 'Redis/SQLite proxy',
    mockifyer: true,
    msw: false,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: false,
    mockoon: false,
    jsonServer: false,
  },
  {
    feature: 'MCP server integration',
    mockifyer: true,
    msw: false,
    polly: false,
    nock: false,
    mirage: false,
    wiremock: false,
    mockoon: false,
    jsonServer: false,
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
          <CardTitle>What Makes Mockifyer Different?</CardTitle>
          <CardDescription>
            Mockifyer&apos;s unique combination of features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold mb-1">📼 Record & Replay in Your Codebase</h4>
              <p className="text-sm text-muted-foreground">
                Intercept fetch and axios calls, record real API responses, and commit the JSON to your repo. 
                Each mock is a searchable file, not buried in database or browser storage.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">🎭 Scenarios for Multi-State Testing</h4>
              <p className="text-sm text-muted-foreground">
                Switch between complete datasets (happy path, error states, edge cases) with environment variables 
                or the dashboard. No need to write separate handlers for each state.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">📱 React Native & Expo Support</h4>
              <p className="text-sm text-muted-foreground">
                Device storage with optional Metro sync middleware keeps repo and simulator in sync. 
                Works with both fetch and axios in React Native apps.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">📅 Deterministic Date Control</h4>
              <p className="text-sm text-muted-foreground">
                Fix dates, apply offsets, or change timezones across your entire test suite. 
                Call <code className="text-xs bg-muted px-1 py-0.5 rounded">getCurrentDate()</code> instead of <code className="text-xs bg-muted px-1 py-0.5 rounded">new Date()</code> and 
                eliminate flaky time-dependent tests.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">🔍 GraphQL Query Normalization</h4>
              <p className="text-sm text-muted-foreground">
                Automatically matches GraphQL requests by normalized query + sorted variables, 
                not just operation name. Handles complex queries correctly out of the box.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">🎛️ Optional Dashboard + Redis/SQLite Proxy</h4>
              <p className="text-sm text-muted-foreground">
                Browse mocks, switch scenarios, and isolate client lanes with per-client Redis storage. 
                Run multiple test environments in parallel without mock conflicts.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">🤖 MCP Server for AI Assistants</h4>
              <p className="text-sm text-muted-foreground">
                Interact with your mocks using natural language in Cursor or Claude Desktop. 
                Query, modify, and trace network calls through the Model Context Protocol.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <strong className="text-foreground">Committed recordings:</strong> JSON mocks checked into the repo, 
              discoverable in your editor and code review
            </li>
            <li>
              <strong className="text-foreground">Scenario-driven testing:</strong> Easily switch between complete 
              datasets for different test states without rewriting handlers
            </li>
            <li>
              <strong className="text-foreground">React Native support:</strong> Full-stack record/replay for mobile 
              apps with Metro sync
            </li>
            <li>
              <strong className="text-foreground">Date determinism:</strong> Eliminate flaky tests caused by 
              time-dependent logic
            </li>
            <li>
              <strong className="text-foreground">Multi-client isolation:</strong> Test parallel flows without 
              mock conflicts using Redis lanes
            </li>
            <li>
              <strong className="text-foreground">AI-native tooling:</strong> Query and modify mocks conversationally 
              through the MCP server
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
