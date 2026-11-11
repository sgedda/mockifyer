import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function Wiremock() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Mockifyer vs WireMock</h1>
        <p className="text-xl text-muted-foreground">A comparison from Mockifyer's author. WireMock is a standalone, language-agnostic mock server. Mockifyer runs in-process in JavaScript and React Native and records real traffic into JSON scenarios.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">&#62; <strong>Disclosure:</strong> I'm Sebastian, and I build Mockifyer. I've tried to keep this comparison fair. Every WireMock claim is sourced at the bottom.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="the-short-version">The short version</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Choose WireMock</strong> when you need a <strong>standalone mock server</strong> that any language or service can call: a JVM shop, a polyglot microservice setup, contract tests against a shared fake, or rich matching, templating and fault injection.</li>
          <li><strong>Choose Mockifyer</strong> when your client is <strong>JavaScript or React Native</strong> and you want the mocking to happen <em>inside</em> the app process: no server to point the app at, recordings in the repo, scenarios you can switch per run.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="how-they-differ">How they differ</h2>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted"></th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">WireMock</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Mockifyer</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Shape</td>
              <td className="border border-border px-4 py-2">A separate HTTP server (standalone JAR, Docker, Helm, or embedded in JVM tests). An npm package is also listed among its distributions.</td>
              <td className="border border-border px-4 py-2">A library in your JS process: patches <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> or adds axios interceptors. An optional dashboard proxy is available.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Clients</td>
              <td className="border border-border px-4 py-2">Any language or client that can make HTTP calls</td>
              <td className="border border-border px-4 py-2">JS clients (axios, fetch) in Node and React Native/Expo</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Pointing the app at it</td>
              <td className="border border-border px-4 py-2">Change the base URL or proxy to the WireMock server</td>
              <td className="border border-border px-4 py-2">No URL change: requests are intercepted where they're made</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Recording</td>
              <td className="border border-border px-4 py-2">Recorder UI at <code className="text-sm bg-muted px-1.5 py-0.5 rounded">/__admin/recorder</code> or the API; proxy to the real API, then stop to generate stub mappings. Snapshotting also exists.</td>
              <td className="border border-border px-4 py-2">Record mode writes request-only stubs by default. Bodies and replay are turned on per path (see <Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link>).</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">"Scenarios"</td>
              <td className="border border-border px-4 py-2">A <strong>state machine</strong>: stubs match on scenario state and can move to a new state</td>
              <td className="border border-border px-4 py-2">A <strong>folder of mocks</strong> (a data set) that you switch between: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">empty</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">error</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">many</code></td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Matching and responses</td>
              <td className="border border-border px-4 py-2">Advanced request matching, response templating, fault and latency injection, extensions</td>
              <td className="border border-border px-4 py-2">Request-key matching (with optional similar-path matching), status and delay overrides, field and date overrides</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">License</td>
              <td className="border border-border px-4 py-2">Apache-2.0</td>
              <td className="border border-border px-4 py-2">MIT</td>
            </tr>
          </table>
        </div>
        <p className="mb-4 text-muted-foreground">The word "scenario" means different things in the two tools. WireMock scenarios model state changes within a session ("after this POST, the GET returns two items"). Mockifyer scenarios are complete, switchable data sets.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-wiremock-is-the-better-choice">Where WireMock is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Non-JS clients.</strong> Java, Go, Python, .NET: anything that talks HTTP.</li>
          <li><strong>One shared fake for many services</strong>, run as a container in a test environment.</li>
          <li><strong>Stateful flows</strong> where a response should change after a specific request.</li>
          <li><strong>Templated or computed responses</strong>, and fault injection at the HTTP level.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-mockifyer-is-the-better-choice">Where Mockifyer is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>React Native and Expo apps.</strong> Pointing a device or simulator at a separate mock server means changing base URLs and handling networking. Mockifyer intercepts <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> in the app, and in E2E a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> launch argument picks the data set. See <Link to="/guides/maestro-detox-mocks" className="text-primary hover:underline">Maestro and Detox</Link>.</li>
          <li><strong>Recordings that live with the code</strong>, reviewed in PRs as JSON.</li>
          <li><strong>Selective recording.</strong> You start with an inventory of stubs and choose what to freeze.</li>
          <li><strong>No JVM</strong> in a JS-only toolchain.</li>
        </ul>
        <p className="mb-4 text-muted-foreground">To be fair, Mockifyer's dashboard proxy mode (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">/api/proxy</code> with a sqlite or redis store) <em>is</em> a local server your app talks to. It's useful for physical devices and for teams sharing scenarios. But it's still the same Mockifyer setup, and the in-process mode doesn't need it.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="using-both">Using both</h2>
        <p className="mb-4 text-muted-foreground">A common split: WireMock fakes third-party or backend-to-backend dependencies in a shared test environment, and Mockifyer handles the JS or React Native client's view of the API during dev and E2E.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/comparisons" className="text-primary hover:underline">All comparisons</Link></li>
          <li><Link to="/guides/maestro-detox-mocks" className="text-primary hover:underline">Mock APIs in Maestro and Detox E2E</Link></li>
          <li><Link to="/guides/mock-at-the-network-edge" className="text-primary hover:underline">Mock at the network edge</Link></li>
          <li><Link to="/comparisons/mockoon" className="text-primary hover:underline">Mockifyer vs Mockoon</Link></li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="sources">Sources</h2>
        <p className="mb-4 text-muted-foreground">WireMock (checked 11 Nov 2026):</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>Docs home (standalone JAR, Docker, Helm, NPM distributions; matching, templating, faults, record/playback; many languages): https://wiremock.org/docs/</li>
          <li>Record and playback (recorder UI <code className="text-sm bg-muted px-1.5 py-0.5 rounded">/__admin/recorder</code>, recording API, snapshotting): https://wiremock.org/docs/record-playback/</li>
          <li>Stateful behaviour (scenarios as state machines): https://wiremock.org/docs/stateful-behaviour/</li>
          <li>Standalone and Docker: https://wiremock.org/docs/standalone/ · https://wiremock.org/docs/standalone/docker/</li>
          <li>License (Apache-2.0): https://github.com/wiremock/wiremock/blob/master/LICENSE.txt</li>
        </ul>
        <p className="mb-4 text-muted-foreground">Mockifyer:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>In-process interception: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-fetch/src/index.ts</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-axios/src/index.ts</code></li>
          <li>Dashboard proxy health (sqlite or redis): <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/utils/dashboard-central-proxy-health.ts</code></li>
          <li>Status/delay overrides: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/types.ts</code> (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">statusOverride</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">responseDelayMs</code>)</li>
        </ul>
      </div>
    </div>
  )
}
