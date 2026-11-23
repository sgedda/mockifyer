import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, FlaskConical, FileCode2, Upload } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import { WANDERWEIRD_ATLAS_HREF, WANDERWEIRD_ATLAS_SHOWCASE } from '@/lib/seo-config'

export default function AtlasFromPlaywright() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1
          className="text-4xl sm:text-5xl font-semibold tracking-tight"
          id="atlas-from-playwright"
        >
          Generate Atlas from Playwright E2E
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Run Playwright against an app that uses Mockifyer. Traffic is recorded into the dashboard
          network log. When the suite finishes, global teardown builds interactive Atlas HTML and CI
          can upload it as an artifact.
        </p>
      </header>

      <div className="p-4 border border-border bg-muted/30 rounded-md">
        <p className="text-sm text-muted-foreground">
          The{' '}
          <a href={WANDERWEIRD_ATLAS_HREF} className="text-primary hover:underline font-medium">
            WanderWeird Atlas showcase
          </a>{' '}
          on this site was produced this way: {WANDERWEIRD_ATLAS_SHOWCASE.totalRequests} requests,{' '}
          {WANDERWEIRD_ATLAS_SHOWCASE.observedEndpoints} observed endpoints, run date{' '}
          {WANDERWEIRD_ATLAS_SHOWCASE.runDate}. See also{' '}
          <Link to="/guides/mockifyer-atlas" className="text-primary hover:underline font-medium">
            Mockifyer Atlas
          </Link>{' '}
          for interactive exploration and the Metro CLI.
        </p>
      </div>

      <section id="playwright-config" className="space-y-4">
        <h2 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <FileCode2 className="h-7 w-7 text-primary" />
          1. Point Playwright at teardown that builds Atlas
        </h2>
        <p className="text-muted-foreground">
          In this repo, <code className="bg-muted px-1 rounded">e2e/playwright.config.ts</code> wires
          setup and teardown. Mockifyer is already recording in the WanderWeird services; teardown
          reads the dashboard network events after the run.
        </p>
        <CodeBlock
          language="typescript"
          code={`// e2e/playwright.config.ts (excerpt)
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: process.env.APP_URL ?? 'http://127.0.0.1:8090',
  },
});`}
        />
      </section>

      <section id="global-teardown" className="space-y-4">
        <h2 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-7 w-7 text-primary" />
          2. Build Atlas HTML after the suite
        </h2>
        <p className="text-muted-foreground">
          <code className="bg-muted px-1 rounded">e2e/global-teardown.ts</code> fetches events from{' '}
          <code className="bg-muted px-1 rounded">GET /api/network-events?limit=10000</code>, scrubs
          secrets with <code className="bg-muted px-1 rounded">scrubNetworkEvent</code>, scans
          WanderWeird source, then calls{' '}
          <code className="bg-muted px-1 rounded">buildAtlasDocHtmlFiles</code> and writes{' '}
          <code className="bg-muted px-1 rounded">e2e/atlas-report/</code>.
        </p>
        <CodeBlock
          language="typescript"
          code={`// e2e/global-teardown.ts (flow)
const dashboardUrl = process.env.MOCKIFYER_DASHBOARD_URL || 'http://127.0.0.1:3002';
const response = await fetch(\`\${dashboardUrl}/api/network-events?limit=10000\`);
const networkEvents = (await response.json()).events || [];
const scrubbedEvents = networkEvents.map(scrubNetworkEvent);

const { scanCodeForEndpoints } = require('../packages/mockifyer-core/dist/utils/atlas-code-scanner.js');
const { buildAtlasDocHtmlFiles } = require('../packages/mockifyer-core/dist/utils/atlas-doc-html.js');

const files = buildAtlasDocHtmlFiles(map, scrubbedEvents, { scannedEndpoints });
// writes e2e/atlas-report/index.html (+ bodies-search.json, …)`}
        />
        <p className="text-sm text-muted-foreground">
          Local command (WanderWeird stack + dashboard must already be running — see{' '}
          <code className="bg-muted px-1 rounded">e2e/README.md</code>):
        </p>
        <CodeBlock
          language="bash"
          code={`cd e2e
npm install
npx playwright install chromium
npm test
# → e2e/atlas-report/index.html`}
        />
      </section>

      <section id="github-actions" className="space-y-4">
        <h2 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Upload className="h-7 w-7 text-primary" />
          3. Upload Atlas HTML as a CI artifact
        </h2>
        <p className="text-muted-foreground">
          From <code className="bg-muted px-1 rounded">.github/workflows/e2e.yml</code> — the same
          step that produced the showcase Atlas:
        </p>
        <CodeBlock
          language="yaml"
          code={`- name: Upload Atlas architecture documentation
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: atlas-architecture
    path: e2e/atlas-report/
    retention-days: 30
    if-no-files-found: warn
    overwrite: true`}
        />
        <p className="text-sm text-muted-foreground">
          On <code className="bg-muted px-1 rounded">main</code>, that workflow can also publish the
          report to GitHub Pages under <code className="bg-muted px-1 rounded">/atlas/</code>.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Minimal checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. App under test uses Mockifyer (axios or fetch) so hops hit the dashboard network log.</p>
          <p>2. Playwright <code className="bg-muted px-1 rounded">globalTeardown</code> builds Atlas from those events.</p>
          <p>3. CI uploads <code className="bg-muted px-1 rounded">e2e/atlas-report/</code> with <code className="bg-muted px-1 rounded">actions/upload-artifact@v4</code>.</p>
          <p>
            4. Optional: refresh the marketing asset with{' '}
            <code className="bg-muted px-1 rounded">npm run sync:atlas</code> in{' '}
            <code className="bg-muted px-1 rounded">mockifyer-web</code>.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <a href={WANDERWEIRD_ATLAS_HREF}>
          <Button>Open WanderWeird Atlas</Button>
        </a>
        <Link to="/guides/mockifyer-atlas">
          <Button variant="outline">Atlas overview guide</Button>
        </Link>
        <Link to="/e2e-tutorial">
          <Button variant="outline">E2E Tutorial</Button>
        </Link>
      </div>
    </div>
  )
}
