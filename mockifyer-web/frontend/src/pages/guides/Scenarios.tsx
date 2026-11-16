import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function Scenarios() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Switch Mock Scenarios for Test Data</h1>
        <p className="text-xl text-muted-foreground">Keep empty, many and error states as Mockifyer scenario folders, and switch between them from the dashboard, env vars, config or React Native launch arguments.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">A scenario is a folder of mocks under <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mock-data/</code>. Each folder is one version of the backend: "no trips yet", "a long list", "server error". Switching the scenario changes what every mocked request returns. You don't touch the test code or the app code.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="folder-layout">Folder layout</h2>
        <CodeBlock language="text" code={`mock-data/
  tasks-empty/
    domain-path-rules.json
    demo.devxtools.dev/tasks/GET_2026-11-10_00-00-00.json   → [] 
  default/
    domain-path-rules.json
    demo.devxtools.dev/tasks/GET_2026-11-10_15-34-10.json   → [{...}, {...}]
    demo.devxtools.dev/tasks/1/GET_2026-11-10_15-34-10.json
  tasks-error/
    domain-path-rules.json
    demo.devxtools.dev/tasks/GET_2026-11-10_00-00-00.json   → status 500`} />
        <p className="mb-4 text-muted-foreground">This is the layout of <a href="https://github.com/sgedda/mockifyer/tree/main/demos/record-replay-basics" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">demos/record-replay-basics</code></a>, which you can run in StackBlitz.</p>
        <p className="mb-4 text-muted-foreground">Two details people miss:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Rules are per scenario.</strong> Each folder has its own <code className="text-sm bg-muted px-1.5 py-0.5 rounded">domain-path-rules.json</code>. Under the default <code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code> mode, a scenario only replays paths whose rule has <code className="text-sm bg-muted px-1.5 py-0.5 rounded">autoMock: true</code>. Any other path goes to the live API. Add a rule for each path you want to mock.</li>
          <li><strong><code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code> isn't a scenario you should keep.</strong> When no scenario is selected, traffic lands in <code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code>. Use named scenarios (including <code className="text-sm bg-muted px-1.5 py-0.5 rounded">default</code>) for anything you commit.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="getting-the-states">Getting the states</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>"Many":</strong> record it. Point your app at an account with real data, set the scenario, and record (see <Link to="/guides/record-replay" className="text-primary hover:underline">Record and Replay</Link>).</li>
          <li><strong>"Empty":</strong> record against an empty account, or copy the mock file and set <code className="text-sm bg-muted px-1.5 py-0.5 rounded">response.data</code> to <code className="text-sm bg-muted px-1.5 py-0.5 rounded">[]</code>. Hand-edited files replay fine. The filename isn't used for matching.</li>
          <li><strong>"Error" and "slow":</strong> keep the recorded success body and add fields to the mock instead of waiting for a real outage:</li>
        </ul>
        <CodeBlock language="json" code={`{
  "request": { "method": "GET", "url": "https://demo.devxtools.dev/tasks", "headers": {} },
  "response": { "status": 200, "data": { "error": "Internal server error" }, "headers": { "content-type": "application/json" } },
  "statusOverride": 500,
  "responseDelayMs": 2000,
  "timestamp": "2026-11-10T00:00:00.000Z"
}`} />
        <p className="mb-4 text-muted-foreground"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">statusOverride</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">responseDelayMs</code> are applied at replay time. You can also set them in the dashboard editor, or with the MCP tool <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockifyer_set_mock_behavior</code>.</p>
        <p className="mb-4 text-muted-foreground">A rule like this one lets a scenario replay but never record, which suits a frozen test fixture:</p>
        <CodeBlock language="json" code={`{ "demo.devxtools.dev/tasks": { "recordResponses": false, "autoMock": true, "updatedAt": "2026-11-10T00:00:00Z" } }`} />
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="switching-scenarios">Switching scenarios</h2>
        <p className="mb-4 text-muted-foreground">The first matching source wins:</p>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Order</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Source</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Typical use</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">1</td>
              <td className="border border-border px-4 py-2">Launch override: React Native <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> launch argument, or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">setScenarioLaunchOverride()</code></td>
              <td className="border border-border px-4 py-2">E2E runs</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">2</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_SCENARIO</code> env</td>
              <td className="border border-border px-4 py-2">CI jobs, scripts</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">3</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">defaultScenario</code> (or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenarios.default</code>) in config</td>
              <td className="border border-border px-4 py-2">Per-test-file setup</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">4</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario-config.json</code> in <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mock-data/</code> (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario-config.&#60;clientId&#62;.json</code> when a client id is set and that file exists)</td>
              <td className="border border-border px-4 py-2">Dashboard switching</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">5</td>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code></td>
              <td className="border border-border px-4 py-2">Nothing selected</td>
            </tr>
          </table>
        </div>
        <h3 className="text-xl font-semibold mb-3 mt-6" id="from-the-dashboard">From the dashboard</h3>
        <CodeBlock language="bash" code={`npx mockifyer-dashboard --path ./mock-data`} />
        <p className="mb-4 text-muted-foreground">With the filesystem store, picking a scenario in the dashboard writes <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mock-data/scenario-config.json</code> (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">&#123; "currentScenario": "tasks-error", ... &#125;</code>). A running Node process reads that file on each request, so the next call uses the new scenario. You don't need to restart. This only applies while nothing higher in the table is set: a process started with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_SCENARIO</code> or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">defaultScenario</code> keeps its scenario. If a scenario name doesn't exist yet when you switch to it, the dashboard creates the folder.</p>
        <p className="mb-4 text-muted-foreground">With the dashboard's sqlite or redis store (proxy mode), the active scenario is stored centrally, and client lanes (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockifyerClientId</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_CLIENT_ID</code>) can each point at a different scenario.</p>
        <h3 className="text-xl font-semibold mb-3 mt-6" id="from-env-or-config">From env or config</h3>
        <CodeBlock language="bash" code={`MOCKIFYER_SCENARIO=tasks-empty npm test`} />
        <CodeBlock language="js" code={`setupMockifyer({
  mockDataPath: './mock-data',
  defaultScenario: 'tasks-error',
  useGlobalFetch: true,
  failOnMissingMock: true,
  domainPathRulesMode: 'record_all',
});`} />
        <p className="mb-4 text-muted-foreground"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">demos/record-replay-basics/api.test.js</code> calls <code className="text-sm bg-muted px-1.5 py-0.5 rounded">setupMockifyer</code> in each <code className="text-sm bg-muted px-1.5 py-0.5 rounded">describe</code> block with a different <code className="text-sm bg-muted px-1.5 py-0.5 rounded">defaultScenario</code>, which gives you one test file that covers all three states.</p>
        <h3 className="text-xl font-semibold mb-3 mt-6" id="from-react-native-launch-arguments">From React Native launch arguments</h3>
        <CodeBlock language="yaml" code={`- launchApp:
    arguments:
      scenario: tasks-empty`} />
        <p className="mb-4 text-muted-foreground">A launch <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> gets the highest priority and switches Mockifyer on for that run. See <Link to="/guides/maestro-detox-mocks" className="text-primary hover:underline">Mock APIs in Maestro and Detox E2E</Link> for Detox and for the Hybrid versus dashboard-proxy caveat.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/dashboard" className="text-primary hover:underline">Dashboard</Link></li>
          <li><Link to="/guides/record-replay" className="text-primary hover:underline">Record and Replay with Mockifyer</Link></li>
          <li><Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link></li>
          <li><Link to="/guides/maestro-detox-mocks" className="text-primary hover:underline">Mock APIs in Maestro and Detox E2E</Link></li>
          <li><Link to="/guides/stable-react-native-e2e" className="text-primary hover:underline">Why React Native E2E flakes</Link></li>
        </ul>
      </div>
    </div>
  )
}
