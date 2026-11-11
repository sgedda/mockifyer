import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function Pollyjs() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Mockifyer vs Polly.js</h1>
        <p className="text-xl text-muted-foreground">A comparison from Mockifyer's author. Polly.js pioneered record/replay with HAR recordings for JavaScript tests. Mockifyer adds a dashboard, scenarios, selective request-only recording and React Native support.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">&#62; <strong>Disclosure:</strong> I'm Sebastian, and I build Mockifyer. Polly.js is the closest ancestor to what Mockifyer does, and I've tried to give it a fair hearing. Every Polly claim below is sourced at the bottom.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="the-short-version">The short version</h2>
        <p className="mb-4 text-muted-foreground">Polly.js (from Netflix) records, replays and stubs HTTP interactions in Node and in the browser, and it stores recordings in HAR format. If you write Mocha or QUnit tests and want "record on the first run, replay afterwards", it's a well-designed tool.</p>
        <p className="mb-4 text-muted-foreground">Mockifyer has the same core idea (record real traffic, replay it), but it's aimed at app development as well as tests. It adds a local dashboard, named scenarios, selective request-only recording, and React Native/Expo support.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="how-they-differ">How they differ</h2>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Polly.js</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Mockifyer</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Core idea</td>
              <td className="border border-border px-4 py-2">Record, replay and stub HTTP interactions</td>
              <td className="border border-border px-4 py-2">Record and replay real HTTP traffic, with selective activation</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Default on a missing recording</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordIfMissing: true</code>: pass through and record the full response</td>
              <td className="border border-border px-4 py-2">Record mode writes a request-only stub and stays live. Bodies and replay are opt-in per path.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Storage</td>
              <td className="border border-border px-4 py-2">HAR recordings through persisters (filesystem, local storage, REST)</td>
              <td className="border border-border px-4 py-2">One JSON file per request: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mock-data/&#60;scenario&#62;/&#60;host&#62;/&#60;path&#62;/…json</code>, or the dashboard's sqlite/redis store</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Environments</td>
              <td className="border border-border px-4 py-2">Node and browser, through adapters (fetch, XHR, node-http, Puppeteer, …)</td>
              <td className="border border-border px-4 py-2">Node (axios, fetch) and React Native/Expo (fetch). Browser support is in progress (PR #495).</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Test integration</td>
              <td className="border border-border px-4 py-2">First-class Mocha and QUnit helpers</td>
              <td className="border border-border px-4 py-2">Framework-agnostic setup call. The repo's demos use Vitest.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Stubbing in code</td>
              <td className="border border-border px-4 py-2">Client-side server: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">server.get('/x').intercept(...)</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">.passthrough()</code></td>
              <td className="border border-border px-4 py-2">No route DSL. You edit recorded JSON, add field/date/status/delay overrides, or use the dashboard.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Switching data sets</td>
              <td className="border border-border px-4 py-2">Named recordings per test</td>
              <td className="border border-border px-4 py-2">Scenarios (folders), switched by dashboard, env, config or an RN launch argument</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Time</td>
              <td className="border border-border px-4 py-2">Can slow down or speed up replay timing</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">getCurrentDate()</code> with a fixed date, offset or timezone for app logic</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">License</td>
              <td className="border border-border px-4 py-2">Apache-2.0</td>
              <td className="border border-border px-4 py-2">MIT</td>
            </tr>
          </table>
        </div>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="release-activity">Release activity</h2>
        <p className="mb-4 text-muted-foreground">When I checked npm on 11 Nov 2026, the most recent <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@pollyjs/core</code> release was <strong>6.0.6, published 20 July 2023</strong>. Since then the repository has had one more release, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@pollyjs/adapter-fetch</code> 6.0.7 in May 2025, which un-deprecated the fetch adapter for Node. Factor that release cadence into a decision to adopt it today.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-polly-js-is-the-better-choice">Where Polly.js is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>You already have Polly recordings</strong>, and your Mocha or QUnit suites depend on its helpers and request events.</li>
          <li><strong>You want HAR.</strong> HAR is a standard format that other tools can open.</li>
          <li><strong>Browser test suites with Puppeteer or XHR</strong>, where Polly's adapters already cover your stack and Mockifyer's browser support isn't released.</li>
          <li><strong>Stubbing in code alongside recordings.</strong> Polly's client-side server handles both in one API.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-mockifyer-is-the-better-choice">Where Mockifyer is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>You don't want to store everything.</strong> Polly records missing requests by default. Mockifyer's default is a request-only stub, and you turn on replay for the paths you care about. See <Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link>.</li>
          <li><strong>Mocks used outside tests</strong>: during dev sessions, demos, or reproducing a tester's bug. The dashboard lets you browse, edit and toggle mocks live.</li>
          <li><strong>Named data states</strong> like <code className="text-sm bg-muted px-1.5 py-0.5 rounded">empty</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">error</code> or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">many</code> as folders you switch at runtime. See <Link to="/guides/scenarios" className="text-primary hover:underline">Scenarios</Link>.</li>
          <li><strong>React Native and Expo</strong>, including Maestro and Detox runs locked to a scenario by launch argument. See <Link to="/guides/maestro-detox-mocks" className="text-primary hover:underline">Maestro and Detox</Link>.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="moving-from-polly">Moving from Polly</h2>
        <p className="mb-4 text-muted-foreground">There's no importer from HAR to Mockifyer mocks today. Mockifyer can <em>export</em> Atlas network captures as HAR (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockifyer-atlas-har</code> in <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-core</code>), but it can't do the reverse. The practical route is to record again with Mockifyer against the same API, one scenario at a time, and run both tools side by side until the suites you care about have moved.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/comparisons" className="text-primary hover:underline">All comparisons</Link></li>
          <li><Link to="/guides/record-replay" className="text-primary hover:underline">Record and Replay with Mockifyer</Link></li>
          <li><Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link></li>
          <li><Link to="/comparisons/nock" className="text-primary hover:underline">Mockifyer vs Nock</Link></li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="sources">Sources</h2>
        <p className="mb-4 text-muted-foreground">Polly.js (checked 11 Nov 2026):</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>README (record/replay/stub; Node and browser; Mocha/QUnit helpers; record to disk or local storage; slow down or speed up time): https://github.com/Netflix/pollyjs</li>
          <li>API docs (modes <code className="text-sm bg-muted px-1.5 py-0.5 rounded">record</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">replay</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">passthrough</code>, client-side server): https://netflix.github.io/pollyjs/#/api</li>
          <li>Configuration (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordIfMissing</code> default <code className="text-sm bg-muted px-1.5 py-0.5 rounded">true</code>): https://github.com/Netflix/pollyjs/blob/master/docs/configuration.md</li>
          <li>HAR persistence (persister builds HAR logs): https://github.com/Netflix/pollyjs/blob/master/packages/@pollyjs/persister/src/index.js</li>
          <li>FS persister: https://github.com/Netflix/pollyjs/blob/master/docs/persisters/fs.md</li>
          <li>npm release dates: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">npm view @pollyjs/core time</code> (6.0.6, 2023-07-20); <code className="text-sm bg-muted px-1.5 py-0.5 rounded">npm view @pollyjs/adapter-fetch time</code> (6.0.7, 2025-05-31): https://www.npmjs.com/package/@pollyjs/core</li>
          <li>Latest commits (2025-05-31, "Publish v6.0.7"): https://github.com/Netflix/pollyjs/commits/master</li>
          <li>License (Apache-2.0): https://github.com/Netflix/pollyjs/blob/master/LICENSE</li>
        </ul>
        <p className="mb-4 text-muted-foreground">Mockifyer:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>Request-only default: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/utils/request-only-mock.ts</code></li>
          <li>File layout: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/utils/file-naming.ts</code></li>
          <li>Scenario precedence: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/utils/scenario.ts</code></li>
          <li>HAR export (Atlas only): <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/cli/atlas-har.ts</code></li>
          <li>Browser support PR (open): https://github.com/sgedda/mockifyer/pull/495</li>
        </ul>
      </div>
    </div>
  )
}
