import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function Mockoon() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Mockifyer vs Mockoon</h1>
        <p className="text-xl text-muted-foreground">A comparison from Mockifyer's author. Mockoon is a desktop app and CLI for designing local mock APIs. Mockifyer records a JS or React Native app's real traffic in-process. They complement each other.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">&#62; <strong>Disclosure:</strong> I'm Sebastian, and I build Mockifyer. Mockoon is good at something Mockifyer doesn't try to do, and I see the two as complementary. Every Mockoon claim is sourced at the bottom.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="the-short-version">The short version</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Choose Mockoon</strong> to <strong>design</strong> a mock API: routes, status codes, templated JSON, OpenAPI import. You run it as a local server from a desktop app, or headless with its CLI or Docker image. It doesn't care what language your client is written in.</li>
          <li><strong>Choose Mockifyer</strong> to <strong>capture</strong> what your JS or React Native app actually sends and receives, keep it as JSON scenarios in the repo, and replay it inside the app.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="how-they-differ">How they differ</h2>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Mockoon</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Mockifyer</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Shape</td>
              <td className="border border-border px-4 py-2">A local mock server you design in a desktop GUI. Runs headless with the CLI (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">@mockoon/cli</code>) or Docker (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockoon/cli</code>).</td>
              <td className="border border-border px-4 py-2">A library in your JS process. Optional local dashboard.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Where mocks come from</td>
              <td className="border border-border px-4 py-2">Routes you design, OpenAPI import, or routes created from logged requests (record button, best with proxy mode)</td>
              <td className="border border-border px-4 py-2">Recordings of real traffic, request-only by default, with bodies and replay turned on per path</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Clients</td>
              <td className="border border-border px-4 py-2">Any client that can call the mock server's URL</td>
              <td className="border border-border px-4 py-2">JS clients (axios, fetch) in Node and React Native/Expo</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">App changes</td>
              <td className="border border-border px-4 py-2">Point the app's base URL at the Mockoon server</td>
              <td className="border border-border px-4 py-2">None: interception happens in-process</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Data sets</td>
              <td className="border border-border px-4 py-2">Environments and routes you set up</td>
              <td className="border border-border px-4 py-2">Scenario folders, switched by dashboard, env, config or an RN launch argument</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Accounts</td>
              <td className="border border-border px-4 py-2">None required for the open-source app</td>
              <td className="border border-border px-4 py-2">None. No account, cloud or telemetry.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">License</td>
              <td className="border border-border px-4 py-2">MIT (Mockoon Pro is a separate paid offering)</td>
              <td className="border border-border px-4 py-2">MIT</td>
            </tr>
          </table>
        </div>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-mockoon-is-the-better-choice">Where Mockoon is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>The API doesn't exist yet</strong>, or you're working from an OpenAPI spec. Designing routes in a GUI beats waiting for something to record.</li>
          <li><strong>Non-JS or mixed clients</strong> that all need the same fake server.</li>
          <li><strong>Visual editing</strong> for people who'd rather not touch code or JSON files.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-mockifyer-is-the-better-choice">Where Mockifyer is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>The API exists and returns big, real payloads</strong>: record once instead of designing responses.</li>
          <li><strong>React Native and Expo</strong>: no base-URL swapping or device networking to a mock server. A launch argument picks the scenario in E2E.</li>
          <li><strong>Selective freezing</strong>: browse the app, then choose which endpoints replay, while the rest stay live.</li>
          <li><strong>Mocks reviewed in PRs</strong> as one JSON file per request.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="using-both">Using both</h2>
        <p className="mb-4 text-muted-foreground">They fit together well. I'd use Mockoon to stand in for an endpoint that hasn't shipped yet, then use Mockifyer once the real API exists and the app should run against recorded reality. You can even point the app at Mockoon and record that traffic with Mockifyer, though at that point you're recording a design rather than the real API.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/comparisons" className="text-primary hover:underline">All comparisons</Link></li>
          <li><Link to="/guides/record-replay" className="text-primary hover:underline">Record and Replay with Mockifyer</Link></li>
          <li><Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link></li>
          <li><Link to="/comparisons/wiremock" className="text-primary hover:underline">Mockifyer vs WireMock</Link></li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="sources">Sources</h2>
        <p className="mb-4 text-muted-foreground">Mockoon (checked 11 Nov 2026):</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>README (desktop app, CLI, Docker image <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockoon/cli</code>, no account required, OpenAPI compatibility, proxy mode, JSON templating, Mockoon Pro): https://github.com/mockoon/mockoon#readme</li>
          <li>Auto-mocking and recording (create routes from logs, record button, best with proxy mode): https://mockoon.com/docs/latest/logging-and-recording/auto-mocking-and-recording/</li>
          <li>OpenAPI import/export: https://mockoon.com/docs/latest/openapi/import-export-openapi-format/</li>
          <li>CLI: https://mockoon.com/cli/</li>
          <li>npm <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@mockoon/cli</code> (license MIT): https://www.npmjs.com/package/@mockoon/cli</li>
        </ul>
        <p className="mb-4 text-muted-foreground">Mockifyer:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>No telemetry, account or cloud (audit of <code className="text-sm bg-muted px-1.5 py-0.5 rounded">main</code>; no analytics, phone-home or postinstall scripts in the packages, dashboard or MCP): https://github.com/sgedda/mockifyer</li>
          <li>License: https://github.com/sgedda/mockifyer/blob/main/LICENSE</li>
        </ul>
      </div>
    </div>
  )
}
