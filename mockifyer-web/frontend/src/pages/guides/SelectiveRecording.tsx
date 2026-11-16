import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function SelectiveRecording() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Selective HTTP Recording, Not Capture-All</h1>
        <p className="text-xl text-muted-foreground">Requests land as request-only stubs in _scratch and stay live until you turn on a domain-path rule and activate the mock. Use capture-all only as a short, heavy try-it option.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">Most of the requests an app makes, you never need as mocks: analytics, feature flags, image CDNs, the endpoints you aren't testing. Storing every response body bloats the repo, and replaying everything hides the one call you meant to control.</p>
        <p className="mb-4 text-muted-foreground">So with recording on, Mockifyer doesn't capture everything by default. It writes a lightweight <strong>request-only stub</strong> for each new request and keeps using the live API. Then you choose which paths should store bodies and replay.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="three-switches-not-one">Three switches, not one</h2>
        <p className="mb-4 text-muted-foreground">It helps to think of three separate decisions:</p>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Decision</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Setting</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Default</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">May Mockifyer write recordings at all?</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordMode</code> (your app sets it, often from <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD</code>)</td>
              <td className="border border-border px-4 py-2">off</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Store response bodies, or request-only stubs?</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordResponses</code> config / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD_RESPONSES</code> env</td>
              <td className="border border-border px-4 py-2">stubs (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">false</code>)</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Which paths may record and replay?</td>
              <td className="border border-border px-4 py-2">domain-path rules (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">domain-path-rules.json</code> per scenario), mode set by <code className="text-sm bg-muted px-1.5 py-0.5 rounded">domainPathRulesMode</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_DOMAIN_PATH_RULES_MODE</code></td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code></td>
            </tr>
          </table>
        </div>
        <p className="mb-4 text-muted-foreground">On top of that, each mock file has its own replay mode, which you set in the dashboard. A freshly recorded mock defaults to "always use live API" until you activate it.</p>
        <p className="mb-4 text-muted-foreground">Note that <code className="text-sm bg-muted px-1.5 py-0.5 rounded">setupMockifyer</code> doesn't read <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD</code> itself. You pass it in:</p>
        <CodeBlock language="ts" code={`import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
  useGlobalFetch: true,
});`} />
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="what-a-default-recording-run-produces">What a default recording run produces</h2>
        <p className="mb-4 text-muted-foreground">Run your app or tests with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD=true</code> and no other flags. If you haven't selected a scenario, files land in the temporary <code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code> scenario:</p>
        <CodeBlock language="text" code={`mock-data/
  _scratch/
    domain-path-rules.json
    api.example.com/
      tasks/GET_2026-11-11_13-29-04.json
      users/GET_2026-11-11_13-29-04.json`} />
        <p className="mb-4 text-muted-foreground">Each file is a stub. It records the request, but there's no response body, and it's flagged to stay live:</p>
        <CodeBlock language="json" code={`{
  "request": { "method": "GET", "url": "https://api.example.com/tasks", "headers": {} },
  "response": { "status": 0, "data": null, "headers": {} },
  "timestamp": "2026-11-11T13:29:04.000Z",
  "responsePending": true,
  "alwaysUseRealApi": true
}`} />
        <p className="mb-4 text-muted-foreground">The rules file lists every host and path seen while recording. Paths are allowed to record, but replay (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">autoMock</code>) is off:</p>
        <CodeBlock language="json" code={`{
  "api.example.com/tasks": { "recordResponses": true, "autoMock": false },
  "api.example.com/users": { "recordResponses": true, "autoMock": false }
}`} />
        <p className="mb-4 text-muted-foreground">Your app's behaviour hasn't changed at all: every call still went to the real API. What you have now is an inventory of what your app calls.</p>
        <p className="mb-4 text-muted-foreground">&#62; <code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code> is meant for exactly this kind of browsing. Select or set a named scenario (including <code className="text-sm bg-muted px-1.5 py-0.5 rounded">default</code>) for mocks you want to keep. With the dashboard's Redis store, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code> mocks expire after <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_SCRATCH_SCENARIO_TTL_SEC</code> (24 hours by default).</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="choosing-what-becomes-a-mock">Choosing what becomes a mock</h2>
        <h3 className="text-xl font-semibold mb-3 mt-6" id="in-the-dashboard">In the dashboard</h3>
        <CodeBlock language="bash" code={`npx mockifyer-dashboard --path ./mock-data`} />
        <p className="mb-4 text-muted-foreground">In the domain tree, each path has:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Record response.</strong> This sets the path's rule to <code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordResponses: true, autoMock: true</code>. Under <code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">autoMock: true</code> is what lets the path replay at all. In dashboard-proxy mode it also makes new cache misses store full bodies.</li>
          <li><strong>Allow upstream.</strong> Off means dashboard-proxy cache misses under this path are blocked (412) instead of calling the real API.</li>
          <li><strong>Replay / Live.</strong> This sets how the mocks that already exist in the folder are served. Switching stubs to Replay marks them "refresh on next request". The next matching call fetches the live response, saves it into the file, and later calls replay it.</li>
        </ul>
        <p className="mb-4 text-muted-foreground">For local (filesystem/Metro) recording, activating a path takes <strong>both</strong> steps: <strong>Record response</strong> on the path, plus <strong>Replay</strong> on its stubs. Replay alone leaves the path gated (requests stay live). Record response alone keeps writing stubs, because body capture locally follows <code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordResponses</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD_RESPONSES</code>.</p>
        <p className="mb-4 text-muted-foreground">Each mock also has its own mode: <em>Use saved mock</em>, <em>Refresh on next request</em>, <em>Always refresh from live</em>, or <em>Always use live API</em>.</p>
        <h3 className="text-xl font-semibold mb-3 mt-6" id="in-the-rules-file-good-for-committing-">In the rules file (good for committing)</h3>
        <p className="mb-4 text-muted-foreground">Rules use longest-prefix matching, and numeric or UUID path segments collapse to <code className="text-sm bg-muted px-1.5 py-0.5 rounded">:id</code>. This file replays <code className="text-sm bg-muted px-1.5 py-0.5 rounded">/tasks</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">/tasks/:id</code> from saved mocks and never records <code className="text-sm bg-muted px-1.5 py-0.5 rounded">/users</code>:</p>
        <CodeBlock language="json" code={`{
  "api.example.com/tasks":     { "recordResponses": true,  "autoMock": true },
  "api.example.com/tasks/:id": { "recordResponses": true,  "autoMock": true },
  "api.example.com/users":     { "recordResponses": false, "autoMock": false, "updatedAt": "2026-11-11T00:00:00Z" }
}`} />
        <p className="mb-4 text-muted-foreground">To fill the allowed paths with bodies without using the dashboard, record once with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD_RESPONSES=true</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false</code>. Under <code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code>, paths with no rule are still discovered and stored during that run, but they don't replay. A deny row like <code className="text-sm bg-muted px-1.5 py-0.5 rounded">/users</code> above keeps a path off disk.</p>
        <p className="mb-4 text-muted-foreground">If you write a "deny" row by hand, include <code className="text-sm bg-muted px-1.5 py-0.5 rounded">updatedAt</code> (the dashboard always does). Without it, a row with both flags off counts as a discovery seed, and a parent rule can switch it back on.</p>
        <h3 className="text-xl font-semibold mb-3 mt-6" id="never-record-certain-hosts">Never record certain hosts</h3>
        <p className="mb-4 text-muted-foreground">For hosts you never want on disk (auth, payments), use recording exclusions. They stop recording only. Replay of existing mocks is unaffected.</p>
        <CodeBlock language="ts" code={`setupMockifyer({
  mockDataPath: './mock-data',
  useGlobalFetch: true,
  recordingExclusions: [{ host: 'auth.example.com' }, { host: 'api.example.com', pathPrefix: '/billing' }],
});`} />
        <p className="mb-4 text-muted-foreground">The same can come from env: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORDING_EXCLUSION_HOSTS=auth.example.com</code> (a comma-separated list), or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORDING_EXCLUSIONS</code> (JSON).</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="rule-modes">Rule modes</h2>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">domainPathRulesMode</code></th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Behaviour</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code> (default)</td>
              <td className="border border-border px-4 py-2">Record and replay only where a matching rule turns them on. With recording on, newly seen paths are added with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordResponses: true, autoMock: false</code>. With recording off, no new rows are written.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">record_all</code></td>
              <td className="border border-border px-4 py-2">Newly seen paths get both flags on. You switch noisy paths off afterwards.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">off</code></td>
              <td className="border border-border px-4 py-2">No gating (the legacy behaviour).</td>
            </tr>
          </table>
        </div>
        <p className="mb-4 text-muted-foreground">One thing to know for CI: under <code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code>, a request to a path with no matching rule goes straight to the live API, <strong>even with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">failOnMissingMock: true</code></strong>. If CI should fail loudly on a missing mock, either commit rules with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">autoMock: true</code> for every path the tests touch, or run replay with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">domainPathRulesMode: 'record_all'</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">failOnMissingMock: true</code>. The <Link to="/guides/record-replay" className="text-primary hover:underline">record and replay guide</Link> has a CI example.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="dashboard-proxy-per-path-body-capture">Dashboard proxy: per-path body capture</h2>
        <p className="mb-4 text-muted-foreground">When traffic goes through the dashboard (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">/api/proxy</code>, with the sqlite or redis store), the per-path rule's <code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordResponses</code> also decides whether a cache miss stores a full body. The order of precedence is: the <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD_RESPONSES</code> env var, then the matching path rule, then the client's setting, then the scenario's proxy config, then the default (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">false</code>). For local filesystem recording, the path rule decides whether the path records at all, and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordResponses</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD_RESPONSES</code> decides body versus stub.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="capture-all-a-heavy-try-it-quickly-option">Capture-all: a heavy "try it quickly" option</h2>
        <p className="mb-4 text-muted-foreground">If you just want to see record and replay working end to end in a throwaway project, you can turn every default the other way:</p>
        <CodeBlock language="bash" code={`MOCKIFYER_RECORD=true \\
MOCKIFYER_RECORD_RESPONSES=true \\
MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false \\
MOCKIFYER_DOMAIN_PATH_RULES_MODE=record_all \\
node your-script.js`} />
        <p className="mb-4 text-muted-foreground">Every request is now stored with its full body and replayed on the next run. That's handy for a five-minute demo (it's exactly what <a href="https://github.com/sgedda/mockifyer/tree/main/demos/record-replay-basics" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">demos/record-replay-basics</code></a> does). It's the wrong default for a real app, though: large payloads, noise in the repo, and mocks you never meant to freeze. Once you've seen it work, go back to the defaults and pick paths.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/config-reference" className="text-primary hover:underline">Config reference</Link></li>
          <li><Link to="/guides/record-replay" className="text-primary hover:underline">Record and Replay with Mockifyer</Link></li>
          <li><Link to="/guides/react-native-expo" className="text-primary hover:underline">React Native and Expo</Link></li>
          <li><Link to="/guides/scenarios" className="text-primary hover:underline">Switch Mock Scenarios for Test Data</Link></li>
          <li><Link to="/guides/mock-drift" className="text-primary hover:underline">Detect mock drift</Link></li>
        </ul>
      </div>
    </div>
  )
}
