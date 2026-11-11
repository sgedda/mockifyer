import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function RecordReplay() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Record and Replay with Mockifyer</h1>
        <p className="text-xl text-muted-foreground">Record real axios or fetch calls in Node, keep the JSON mocks in your repo, and replay them in tests and CI with Mockifyer.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">This guide shows the basic Node workflow: run your code once against the real API, keep the recordings as JSON next to your code, and replay them in tests and CI. It works with axios (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-axios</code>) and with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-fetch</code>). Your request code doesn't change.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="install">Install</h2>
        <CodeBlock language="bash" code={`# axios
npm install --save-dev @sgedda/mockifyer-axios @sgedda/mockifyer-core
# or fetch (Node 18+ global fetch)
npm install --save-dev @sgedda/mockifyer-fetch @sgedda/mockifyer-core`} />
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="set-up">Set up</h2>
        <p className="mb-4 text-muted-foreground">Call <code className="text-sm bg-muted px-1.5 py-0.5 rounded">setupMockifyer</code> once, early. Mockifyer doesn't read <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD</code> on its own, so pass it in yourself.</p>
        <p className="mb-4 text-muted-foreground"><strong>axios:</strong></p>
        <CodeBlock language="ts" code={`import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
  useGlobalAxios: true,
});

// then import and use axios as usual
import axios from 'axios';`} />
        <p className="mb-4 text-muted-foreground"><strong>fetch:</strong></p>
        <CodeBlock language="ts" code={`import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
  useGlobalFetch: true,
});`} />
        <p className="mb-4 text-muted-foreground">If you'd rather not patch the global axios, pass <code className="text-sm bg-muted px-1.5 py-0.5 rounded">useGlobalAxios: false</code> plus <code className="text-sm bg-muted px-1.5 py-0.5 rounded">axiosInstance: axios</code>, and call the returned client's <code className="text-sm bg-muted px-1.5 py-0.5 rounded">get</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">post</code> methods.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="record">Record</h2>
        <CodeBlock language="bash" code={`MOCKIFYER_RECORD=true MOCKIFYER_SCENARIO=default npm run dev`} />
        <p className="mb-4 text-muted-foreground">Setting a scenario (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">default</code> here) keeps the files out of the temporary <code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code> bucket. By default each new request is saved as a <strong>request-only stub</strong> with no body, and the real API keeps answering. Then you choose which endpoints become real mocks:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>Open the dashboard (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">npx mockifyer-dashboard --path ./mock-data</code>). For each path you care about, click <strong>Record response</strong> (this lets the path replay) and set its folder to <strong>Replay</strong> (stubs capture their body on the next matching request, then replay).</li>
          <li>Or, without the dashboard: commit a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">domain-path-rules.json</code> in the scenario folder with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordResponses: true, autoMock: true</code> for those paths, then record once with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD_RESPONSES=true MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false</code>. Paths without a rule still get discovered and stored, but they don't replay. Add a deny rule for any path you don't want on disk at all.</li>
        </ul>
        <p className="mb-4 text-muted-foreground"><Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link> explains these steps in detail. For a throwaway demo you can capture every body at once, but it's heavy. The same guide covers it.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="what-lands-in-the-repo">What lands in the repo</h2>
        <CodeBlock language="text" code={`mock-data/
  default/
    domain-path-rules.json
    api.example.com/
      tasks/GET_2026-11-10_15-34-10.json
      tasks/1/GET_2026-11-10_15-34-10.json`} />
        <p className="mb-4 text-muted-foreground">The layout is <code className="text-sm bg-muted px-1.5 py-0.5 rounded">&#60;scenario&#62;/&#60;host&#62;/&#60;path…&#62;/&#60;METHOD&#62;_&#60;timestamp&#62;.json</code>. GraphQL requests go under <code className="text-sm bg-muted px-1.5 py-0.5 rounded">&#60;host&#62;/graphql/</code>. On <code className="text-sm bg-muted px-1.5 py-0.5 rounded">main</code>, filenames also get a short request-hash suffix (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">…_&#60;hash&#62;.json</code>), so two different calls recorded in the same second don't collide. That change isn't in the npm releases yet. Each file is plain JSON (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">request</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">response</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">timestamp</code>, plus optional <code className="text-sm bg-muted px-1.5 py-0.5 rounded">statusOverride</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">responseDelayMs</code>, field and date overrides), so you review mock changes in the same PR as the code.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="replay-in-tests">Replay in tests</h2>
        <p className="mb-4 text-muted-foreground">Here is a Vitest example, adapted from <code className="text-sm bg-muted px-1.5 py-0.5 rounded">demos/record-replay-basics</code>:</p>
        <CodeBlock language="js" code={`import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const originalFetch = globalThis.fetch;

describe('tasks API', () => {
  beforeAll(() => {
    setupMockifyer({
      mockDataPath: './mock-data',
      defaultScenario: 'default',
      recordMode: false,
      useGlobalFetch: true,
      domainPathRulesMode: 'record_all',
      failOnMissingMock: true,
    });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('replays /tasks/1', async () => {
    const res = await fetch('https://demo.devxtools.dev/tasks/1');
    expect(await res.json()).toEqual({
      id: 1, title: 'Set up project repository', completed: true, userId: 1,
    });
  });
});`} />
        <p className="mb-4 text-muted-foreground">Why <code className="text-sm bg-muted px-1.5 py-0.5 rounded">domainPathRulesMode: 'record_all'</code> while replaying? Under the default <code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code> mode, a request with no matching rule goes to the live API without consulting <code className="text-sm bg-muted px-1.5 py-0.5 rounded">failOnMissingMock</code>. With <code className="text-sm bg-muted px-1.5 py-0.5 rounded">record_all</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordMode: false</code>, nothing gets recorded, and a missing mock throws <code className="text-sm bg-muted px-1.5 py-0.5 rounded">No mock data found for request: …</code> instead of silently hitting the network. The other option is to commit rules with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">autoMock: true</code> for every path your tests use.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="ci">CI</h2>
        <p className="mb-4 text-muted-foreground">Replay needs no network access to the APIs you mocked, and no extra services:</p>
        <CodeBlock language="yaml" code={`# .github/workflows/test.yml
name: test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
        env:
          MOCKIFYER_RECORD: 'false'`} />
        <p className="mb-4 text-muted-foreground">Never set <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_RECORD=true</code> in CI. Recording belongs on a developer machine, where you can review the diff.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="updating-mocks-when-the-api-changes">Updating mocks when the API changes</h2>
        <p className="mb-4 text-muted-foreground">If a mock already exists for a request, recording again doesn't write a second file. The existing mock is served, or skipped if it's set to live. To refresh one:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>In the dashboard, set the mock to <strong>Refresh on next request</strong> (one fresh capture, then back to the saved mock) or <strong>Always refresh from live</strong>.</li>
          <li>Or delete the file and record that call again.</li>
        </ul>
        <p className="mb-4 text-muted-foreground">Comparing old and new responses is covered in <Link to="/guides/mock-drift" className="text-primary hover:underline">Detect mock drift</Link>.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="production-safety">Production safety</h2>
        <p className="mb-4 text-muted-foreground">Only call <code className="text-sm bg-muted px-1.5 py-0.5 rounded">setupMockifyer</code> outside production, or set <code className="text-sm bg-muted px-1.5 py-0.5 rounded">activationMode: 'off'</code> (env <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_ACTIVATION_MODE=off</code>). In shared dev environments, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">activationMode: 'client_id_header'</code> limits Mockifyer to requests that carry an <code className="text-sm bg-muted px-1.5 py-0.5 rounded">X-Mockifyer-Client-Id</code> header.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/config-reference" className="text-primary hover:underline">Config reference</Link></li>
          <li><Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording, Not Capture-All</Link></li>
          <li><Link to="/guides/scenarios" className="text-primary hover:underline">Switch Mock Scenarios for Test Data</Link></li>
          <li><Link to="/guides/mock-drift" className="text-primary hover:underline">Detect mock drift</Link></li>
          <li><Link to="/guides/browser-record-replay" className="text-primary hover:underline">Browser record and replay</Link> <em>(pending PR #495)</em></li>
          <li><Link to="/comparisons/pollyjs" className="text-primary hover:underline">Mockifyer vs Polly.js</Link> · <Link to="/comparisons/nock" className="text-primary hover:underline">Mockifyer vs Nock</Link></li>
        </ul>
      </div>
    </div>
  )
}
