import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function Nock() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Mockifyer vs Nock</h1>
        <p className="text-xl text-muted-foreground">A comparison from Mockifyer's author. Nock is the go-to for assertion-heavy Node.js unit tests. Mockifyer records real responses into JSON scenarios for dev, E2E and React Native.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">&#62; <strong>Disclosure:</strong> I'm Sebastian, and I build Mockifyer. I've tried to keep this comparison fair. Every Nock claim is sourced at the bottom.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="the-short-version">The short version</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Choose Nock</strong> for Node.js unit and integration tests where you want to declare the exact request you expect and <em>assert</em> that it happened (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">scope.done()</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">isDone()</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">pendingMocks()</code>). It's precise, and the mocks live right in the test file.</li>
          <li><strong>Choose Mockifyer</strong> when you want realistic data recorded from the real API, kept as JSON scenarios, and reused across dev sessions, E2E runs and React Native apps, not only inside one test file.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="how-they-differ">How they differ</h2>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Nock</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Mockifyer</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Typical definition</td>
              <td className="border border-border px-4 py-2">Method chaining in the test: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">nock('https://api.example.com').get('/user').reply(200, &#123;...&#125;)</code></td>
              <td className="border border-border px-4 py-2">Recorded JSON files in <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mock-data/&#60;scenario&#62;/…</code>, edited in the dashboard or by hand</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Assertions</td>
              <td className="border border-border px-4 py-2">Built in: every interceptor is expected once by default. <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scope.done()</code> throws if one wasn't called.</td>
              <td className="border border-border px-4 py-2">No request-expectation API. You assert on your app's behaviour. <code className="text-sm bg-muted px-1.5 py-0.5 rounded">failOnMissingMock</code> fails on unmocked requests (see the note in <Link to="/guides/record-replay" className="text-primary hover:underline">Record and Replay</Link>).</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Recording</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">nock.recorder.rec()</code> prints or returns code or objects. <strong>Nock Back</strong> records fixtures with modes <code className="text-sm bg-muted px-1.5 py-0.5 rounded">wild</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">dryrun</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">record</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">update</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">lockdown</code>.</td>
              <td className="border border-border px-4 py-2">Record mode writes request-only stubs by default. Bodies and replay are turned on per path.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Environments</td>
              <td className="border border-border px-4 py-2">Node.js (overrides <code className="text-sm bg-muted px-1.5 py-0.5 rounded">http.request</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">http.ClientRequest</code>; native <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> supported since v14)</td>
              <td className="border border-border px-4 py-2">Node.js (axios, fetch) and React Native/Expo (fetch)</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Data sets</td>
              <td className="border border-border px-4 py-2">Per test: whatever the test sets up</td>
              <td className="border border-border px-4 py-2">Named scenarios, switched by dashboard, env, config or an RN launch argument</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Outside tests</td>
              <td className="border border-border px-4 py-2">Not its focus</td>
              <td className="border border-border px-4 py-2">Dev sessions, demos, reproducing bugs, E2E</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">License</td>
              <td className="border border-border px-4 py-2">MIT</td>
              <td className="border border-border px-4 py-2">MIT</td>
            </tr>
          </table>
        </div>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-nock-is-the-better-choice">Where Nock is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Assertion-heavy unit tests.</strong> "This function must call <code className="text-sm bg-muted px-1.5 py-0.5 rounded">POST /orders</code> exactly once with this body" is what Nock is built for.</li>
          <li><strong>Small, synthetic responses.</strong> For a 3-field reply, writing <code className="text-sm bg-muted px-1.5 py-0.5 rounded">.reply(200, &#123;...&#125;)</code> inline is clearer than a recorded file.</li>
          <li><strong>Fine-grained request matching in code</strong>: body and query matchers, header matching, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">.times()</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">.persist()</code>, delays and error replies, all next to the test.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-mockifyer-is-the-better-choice">Where Mockifyer is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Large, real payloads</strong> that you don't want to hand-write in every test.</li>
          <li><strong>Mocks shared across tools.</strong> The same scenario folder serves your Node tests, your dev server and your React Native app.</li>
          <li><strong>Choosing which endpoints to freeze</strong> with selective recording, while the rest stay live. See <Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link>.</li>
          <li><strong>Switching state</strong> (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">empty</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">many</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">error</code>) without changing test code. See <Link to="/guides/scenarios" className="text-primary hover:underline">Scenarios</Link>.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="using-both">Using both</h2>
        <p className="mb-4 text-muted-foreground">They can live in the same repo: Nock in unit tests that assert on outgoing calls, Mockifyer in integration and E2E runs that need realistic data. Don't run both on the same request in the same process. Both work at the request level in Node, and only one should answer.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/comparisons" className="text-primary hover:underline">All comparisons</Link></li>
          <li><Link to="/guides/record-replay" className="text-primary hover:underline">Record and Replay with Mockifyer</Link></li>
          <li><Link to="/guides/scenarios" className="text-primary hover:underline">Switch Mock Scenarios for Test Data</Link></li>
          <li><Link to="/comparisons/pollyjs" className="text-primary hover:underline">Mockifyer vs Polly.js</Link></li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="sources">Sources</h2>
        <p className="mb-4 text-muted-foreground">Nock (checked 11 Nov 2026):</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>README: how it works (overrides <code className="text-sm bg-muted px-1.5 py-0.5 rounded">http.request</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">http.ClientRequest</code>), expectations (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">scope.done()</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">isDone()</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">pendingMocks()</code>), recording (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">nock.recorder.rec()</code>), Nock Back modes: https://github.com/nock/nock#readme</li>
          <li>v14.0.0 release notes (native <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> support, Node ≥ 18), published 2025-01-24: https://github.com/nock/nock/releases/tag/v14.0.0</li>
          <li>MSW comparison page, stating that Nock uses MSW's interception algorithm: https://mswjs.io/docs/comparison#nock</li>
          <li>License (MIT): https://github.com/nock/nock/blob/main/LICENSE</li>
        </ul>
        <p className="mb-4 text-muted-foreground">Mockifyer:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><code className="text-sm bg-muted px-1.5 py-0.5 rounded">failOnMissingMock</code> and allowlist behaviour: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/types.ts</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/utils/domain-path-rules.ts</code> (verified locally with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-fetch@1.8.106</code>)</li>
          <li>Scenario precedence: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/utils/scenario.ts</code></li>
        </ul>
      </div>
    </div>
  )
}
