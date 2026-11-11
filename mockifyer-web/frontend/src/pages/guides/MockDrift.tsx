import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import RunItButton from '@/components/RunItButton'
import QuickStartBox from '@/components/QuickStartBox'

export default function MockDrift() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" id="mock-drift">
          Stop Mock Drift
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Hand-written mocks drift from real APIs. Record real responses, re-record when APIs change, and diff to catch breaking changes.
        </p>
      </header>

      <QuickStartBox variant="node-fetch" />

      <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200 text-sm">
            <strong>The Problem:</strong> Your API changes <code className="bg-muted px-1 rounded">{`{error}`}</code> to <code className="bg-muted px-1 rounded">{`{message}`}</code>, 
            but your hand-written mocks still return <code className="bg-muted px-1 rounded">{`{error}`}</code>. Tests pass, bugs ship.
          </div>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-base leading-relaxed">
            Hand-written mocks drift from the real API over time—field names change, new required fields appear, and nested structures evolve. 
            AI-generated tests often compound the problem by mocking everything and asserting against invented shapes that never existed in production. 
            Recording real responses and replaying them keeps your fixtures honest: they reflect the API's actual contract at capture time. 
            When you suspect drift, re-record and diff the new responses against the old—breaking changes surface immediately as test failures, not production incidents.
          </p>
        </CardContent>
      </Card>
      
      <div className="flex justify-center">
        <RunItButton 
          project="mock-drift-detection"
          title="Try Drift Detection Demo"
          size="default"
        />
      </div>

      <section id="the-drift-problem">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">What is Mock Drift?</h2>
        <p className="text-muted-foreground mb-4">
          Mock drift happens when your mocks no longer match the real API. Common causes:
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hand-Written Mock</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock language="json" code={`// Written 6 months ago
{
  "id": 123,
  "name": "Paris",
  "error": "Unavailable"
}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Real API Today</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock language="json" code={`// API changed 2 months ago
{
  "id": 123,
  "title": "Paris",      // was "name"
  "message": "Unavailable" // was "error"
}`} />
            </CardContent>
          </Card>
        </div>

        <p className="text-muted-foreground mt-4">
          Your tests still pass (they use the hand-written mock), but production breaks because the app expects <code className="bg-muted px-1 rounded">title</code> and <code className="bg-muted px-1 rounded">message</code>.
        </p>
      </section>

      <section id="record-vs-handwrite">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Record vs Hand-Write</h2>
        
        <div className="space-y-6">
          <Card className="border-red-500/50 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                Hand-Written Mocks Drift
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock language="typescript" code={`// mocks/trips.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/trips/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 123,
        name: 'Paris',           // ❌ API changed to "title"
        error: 'Unavailable'      // ❌ API changed to "message"
      })
    );
  })
];`} />
              <p className="text-sm text-muted-foreground">
                <strong>Problems:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Written once, never updated when the API changes</li>
                <li>• No connection to the real API shape</li>
                <li>• False positives: tests pass but production breaks</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Recorded Responses Stay Fresh
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock language="json" code={`// mock-data/default/demo.devxtools.dev/tasks/GET_2026-11-10_15-34-10.json
{
  "request": {
    "method": "GET",
    "url": "https://demo.devxtools.dev/tasks"
  },
  "response": {
    "status": 200,
    "data": [
      { "id": 1, "title": "Set up project repository", "completed": true, "userId": 1 },
      { "id": 2, "title": "Write API documentation", "completed": true, "userId": 1 }
    ],
    "headers": { ... }
  },
  "timestamp": "2026-11-10T15:34:10.459Z",
  "duration": 158
}`} />
              <p className="text-sm text-muted-foreground">
                <strong>Benefits:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Captured from the real API, so it starts accurate</li>
                <li>• Re-record to pull in API changes</li>
                <li>• Diff old vs new to catch breaking changes</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="re-record">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Re-Record When APIs Change</h2>
        <p className="text-muted-foreground mb-4">
          When you suspect an API has changed, re-record the mocks. Mockifyer saves new responses to the same files, 
          so you can <code className="bg-muted px-1 rounded">git diff</code> to see exactly what changed.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Re-Recording Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. Enable recording mode</h4>
              <CodeBlock language="bash" code={`MOCKIFYER_RECORD=true npm run dev`} />
              <p className="text-sm text-muted-foreground mt-2">
                Requests land in <code className="text-xs bg-muted px-1 py-0.5 rounded">_scratch/</code> and keep calling the live API. Activate mocks in the dashboard (untick "Always use live API") or use domain-path rules to record responses. For quick demos, see <code className="text-xs bg-muted px-1 py-0.5 rounded">demos/mock-drift-detection/record.js</code> which uses <code className="text-xs bg-muted px-1 py-0.5 rounded">recordResponses: true</code> + <code className="text-xs bg-muted px-1 py-0.5 rounded">domainPathRulesMode: 'record_all'</code> (heavy).
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Trigger the API calls</h4>
              <p className="text-sm text-muted-foreground">
                Click through your app to make the same requests. New recordings get a new timestamped filename (e.g., <code className="bg-muted px-1 rounded">GET_2026-11-11_10-00-00.json</code>), so record into a new scenario folder like <code className="bg-muted px-1 rounded">updated/</code> and diff the folders.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Review the diff</h4>
              <CodeBlock language="bash" code={`# Compare scenario folders
diff -r mock-data/default/ mock-data/updated/

# Or diff individual files
diff mock-data/default/demo.devxtools.dev/tasks/GET_2026-06-01_10-00-00.json \\
     mock-data/updated/demo.devxtools.dev/tasks/GET_2026-11-10_15-00-00.json`} />
              <p className="text-sm text-muted-foreground mt-2">
                This shows exactly what the API changed. If you see breaking changes (fields renamed, types changed), 
                update your app code before committing the new mocks. The <code className="bg-muted px-1 rounded">demos/mock-drift-detection</code> example does exactly this.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Example Diff</h4>
              <CodeBlock language="diff" code={`  "response": {
    "status": 200,
    "data": {
      "id": 123,
-     "name": "Paris",
+     "title": "Paris",
-     "error": "Unavailable"
+     "message": "Unavailable"
    }
  }`} />
              <p className="text-sm text-muted-foreground mt-2">
                You can see the API changed <code className="bg-muted px-1 rounded">name</code> → <code className="bg-muted px-1 rounded">title</code> and <code className="bg-muted px-1 rounded">error</code> → <code className="bg-muted px-1 rounded">message</code>. 
                Fix your app code to use the new fields, then commit the updated mocks.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="msw-vs-record">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">MSW vs Record-and-Replay</h2>
        <p className="text-muted-foreground mb-4">
          <a href="https://mswjs.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mock Service Worker (MSW)</a> is 
          a popular mocking library that intercepts requests in-browser or in Node. Here's an honest comparison:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-semibold"></th>
                <th className="pb-2 pr-4 font-semibold">MSW (Hand-Written)</th>
                <th className="pb-2 font-semibold">Mockifyer (Record-Replay)</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b align-top">
                <td className="py-3 pr-4 font-semibold text-foreground">Mock Definition</td>
                <td className="py-3 pr-4">
                  TypeScript handlers with full control over logic
                </td>
                <td className="py-3">
                  JSON files recorded from real API
                </td>
              </tr>
              <tr className="border-b align-top">
                <td className="py-3 pr-4 font-semibold text-foreground">Stays Fresh</td>
                <td className="py-3 pr-4">
                  <span className="text-red-600 dark:text-red-400">✗ Manually updated</span>
                </td>
                <td className="py-3">
                  <span className="text-primary">✓ Re-record to sync with API</span>
                </td>
              </tr>
              <tr className="border-b align-top">
                <td className="py-3 pr-4 font-semibold text-foreground">Diff Breaking Changes</td>
                <td className="py-3 pr-4">
                  <span className="text-red-600 dark:text-red-400">✗ No connection to real API</span>
                </td>
                <td className="py-3">
                  <span className="text-primary">✓ git diff shows API changes</span>
                </td>
              </tr>
              <tr className="border-b align-top">
                <td className="py-3 pr-4 font-semibold text-foreground">Dynamic Logic</td>
                <td className="py-3 pr-4">
                  <span className="text-primary">✓ Full JavaScript control</span>
                </td>
                <td className="py-3">
                  <span className="text-red-600 dark:text-red-400">✗ Static JSON (use scenarios for variants)</span>
                </td>
              </tr>
              <tr className="border-b align-top">
                <td className="py-3 pr-4 font-semibold text-foreground">Edge Cases</td>
                <td className="py-3 pr-4">
                  <span className="text-amber-600 dark:text-amber-400">~ Must write each case by hand</span>
                </td>
                <td className="py-3">
                  <span className="text-primary">✓ Record from real API (errors, slow responses, etc.)</span>
                </td>
              </tr>
              <tr className="border-b align-top">
                <td className="py-3 pr-4 font-semibold text-foreground">React Native Support</td>
                <td className="py-3 pr-4">
                  <span className="text-muted-foreground">⚠ RN via <code className="text-xs bg-muted px-1 py-0.5 rounded">msw/native</code> + polyfills</span>
                </td>
                <td className="py-3">
                  <span className="text-primary">✓ React Native, Expo, Node, browser</span>
                </td>
              </tr>
              <tr className="border-b align-top">
                <td className="py-3 pr-4 font-semibold text-foreground">Best For</td>
                <td className="py-3 pr-4">
                  Tests that need complex conditional logic in mocks
                </td>
                <td className="py-3">
                  Tests that need real API shapes and easy re-recording
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 border border-blue-500/50 bg-blue-500/10 rounded-md">
          <p className="text-blue-900 dark:text-blue-200 text-sm">
            <strong>Honest take:</strong> MSW is great for unit tests where you need fine-grained control over mock logic. 
            Mockifyer is better for integration and E2E tests where you want real API shapes and easy re-recording. 
            Many teams use both: MSW for unit tests, Mockifyer for E2E.
          </p>
        </div>
      </section>

      <section id="learn-more">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Learn More</h2>
        <div className="grid gap-4">
          <Link to="/getting-started">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-sm text-muted-foreground">
                  Install Mockifyer and record your first responses
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/guides/mock-at-the-network-edge">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Mock at the Network Edge</h3>
                <p className="text-sm text-muted-foreground">
                  Why mocking HTTP is better than mocking hooks and components
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/dashboard">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  Browse and edit mocks with a local web UI
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  )
}
