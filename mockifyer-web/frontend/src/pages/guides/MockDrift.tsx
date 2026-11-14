import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Clock, TrendingUp } from 'lucide-react'
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
          Catch API Drift Before Production
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Mocks drift when APIs evolve. The new drift check CLI compares your recorded mocks against live staging APIs nightly, 
          so breaking changes surface in CI instead of production.
        </p>
      </header>

      <QuickStartBox variant="node-fetch" />

      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md mb-6">
        <p className="text-sm text-muted-foreground">
          <strong>Already ran <code className="bg-muted px-1 rounded">npx mockifyer init</code>?</strong> Skip to <a href="#install-drift-check" className="text-primary hover:underline">Install the Drift Check CLI</a> if you've set up Mockifyer recording.
        </p>
      </div>

      <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200 text-sm">
            <strong>Real Example:</strong> The WanderWeird trips API renames <code className="bg-muted px-1 rounded">name</code> to <code className="bg-muted px-1 rounded">title</code>. 
            Hand-written mocks still return <code className="bg-muted px-1 rounded">name</code>. Tests pass. Production breaks.
          </div>
        </div>
      </div>

      <div className="p-4 border border-blue-500/50 bg-blue-500/10 rounded-md">
        <p className="text-blue-900 dark:text-blue-200 text-sm">
          <strong>New:</strong> The <code className="bg-muted px-1 py-0.5 rounded">mockifyer-drift-check</code> CLI 
          (requires <code className="bg-muted px-1 py-0.5 rounded">@sgedda/mockifyer-core</code> ≥1.10.194) 
          compares recorded mocks with live APIs. Run it nightly in GitHub Actions to catch breaking changes before they ship.
        </p>
      </div>

      <div className="flex justify-center">
        <RunItButton 
          project="mock-drift-detection"
          title="Try Drift Detection Demo"
          size="default"
        />
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-xl">📹 See It In Action</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <video 
              controls 
              muted
              className="w-full rounded-lg border"
              poster="/videos/drift-demo/drift-workflow-demo.gif"
            >
              <source src="/videos/drift-demo/drift-workflow-demo.mp4" type="video/mp4" />
              <img 
                src="/videos/drift-demo/drift-workflow-demo.gif" 
                alt="Drift detection workflow: dashboard shows green status on v1, API switches to v2 with breaking changes, drift detected, accept live response, green again"
                className="w-full"
              />
            </video>
            <p className="text-sm text-muted-foreground">
              Dashboard workflow: <code className="bg-muted px-1 rounded">GET /api/trips</code> is green on v1 → 
              live API switches to v2 (<code className="bg-muted px-1 rounded">departureDate</code> removed, 
              <code className="bg-muted px-1 rounded">departsAt</code> added, 
              <code className="bg-muted px-1 rounded">passengers</code> type changed) → 
              breaking drift detected → accept live response → green again
            </p>
          </div>
        </CardContent>
      </Card>

      <section id="why-mocks-drift">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Why Mocks Drift</h2>
        
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="mb-4">
                The <strong>WanderWeird</strong> travel app records mocks from a staging API. 
                Three months later, the backend team renames <code className="bg-muted px-1 rounded">trip.name</code> to <code className="bg-muted px-1 rounded">trip.title</code>.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Recorded Mock (3 months ago)</h4>
                  <CodeBlock language="json" code={`{
  "id": 123,
  "name": "Paris Adventure",
  "destination": "Paris",
  "startDate": "2027-06-15"
}`} />
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-sm">Live API Today</h4>
                  <CodeBlock language="json" code={`{
  "id": 123,
  "title": "Paris Adventure",
  "destination": "Paris", 
  "startDate": "2027-06-15"
}`} />
                </div>
              </div>

              <p className="text-muted-foreground text-sm mt-4">
                Tests replay the old mock with <code className="bg-muted px-1 rounded">name</code> and pass. 
                Production calls the live API, expects <code className="bg-muted px-1 rounded">title</code>, and crashes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Common Drift Causes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• <strong>Field renames:</strong> <code className="bg-muted px-1 rounded">name</code> → <code className="bg-muted px-1 rounded">title</code></li>
                <li>• <strong>Type changes:</strong> <code className="bg-muted px-1 rounded">id: "123"</code> → <code className="bg-muted px-1 rounded">id: 123</code></li>
                <li>• <strong>Removed fields:</strong> <code className="bg-muted px-1 rounded">error</code> → <code className="bg-muted px-1 rounded">message</code></li>
                <li>• <strong>New required fields:</strong> API adds <code className="bg-muted px-1 rounded">version</code>, old mocks don't have it</li>
                <li>• <strong>Old recordings:</strong> Mocks captured 6 months ago, never refreshed</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="drift-watch-setup">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          <TrendingUp className="inline-block h-7 w-7 mr-2 mb-1" />
          Set Up a Drift-Watch Scenario
        </h2>
        
        <p className="text-muted-foreground mb-4">
          Record a <strong>drift-watch</strong> scenario against your staging API. This becomes your contract baseline. 
          Drift check compares it nightly against the live staging API.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>1. Record from Staging with Selective Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              WanderWeird records from <code className="bg-muted px-1 rounded">https://staging.wanderweird.dev</code>. 
              Recording is selective by default: requests land in <code className="bg-muted px-1 rounded">_scratch/</code>, 
              then you promote the 10-30 critical endpoints to a named scenario.
            </p>

            <CodeBlock language="typescript" code={`// Record to drift-watch scenario
setupMockifyer({
  scenario: 'drift-watch',
  recordMode: true,
  baseUrl: 'https://staging.wanderweird.dev',
  dateManipulation: {
    fixedDate: '2027-06-01T00:00:00Z'  // Freeze time for "upcoming trips"
  }
});`} />

            <p className="text-sm text-muted-foreground">
              <strong>Why freeze dates?</strong> WanderWeird's <code className="bg-muted px-1 rounded">/trips/upcoming</code> endpoint 
              returns trips starting after today. If you record on Nov 13, 2026, trips from June 2027 are "upcoming". 
              Six months later, those trips are in the past, and the live API returns <code className="bg-muted px-1 rounded">[]</code>. 
              Freezing time at <code className="bg-muted px-1 rounded">2027-06-01</code> keeps recorded trips "upcoming" during replay.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Promote Critical Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click through the app. Requests land in <code className="bg-muted px-1 rounded">_scratch/</code>. 
              Use the dashboard to promote the important ones to <code className="bg-muted px-1 rounded">drift-watch</code>:
            </p>

            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><code className="bg-muted px-1 rounded">GET /trips/upcoming</code></li>
              <li><code className="bg-muted px-1 rounded">GET /trips/:id</code></li>
              <li><code className="bg-muted px-1 rounded">GET /destinations</code></li>
              <li><code className="bg-muted px-1 rounded">GET /user/profile</code></li>
            </ul>

            <p className="text-sm text-muted-foreground">
              You now have 10-30 golden path responses. Commit them: <code className="bg-muted px-1 rounded">git add mock-data/drift-watch/ && git commit</code>.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="config">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Configure Drift Check</h2>
        
        <p className="text-muted-foreground mb-4">
          Create <code className="bg-muted px-1 rounded">mockifyer.drift.json</code> in your project root with baseUrl, 
          ignorePaths, and per-endpoint severity rules.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>mockifyer.drift.json</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="json" code={`{
  "scenario": "drift-watch",
  "baseUrl": "https://staging.wanderweird.dev",
  "headers": {
    "Authorization": "Bearer \${API_TOKEN}"
  },
  "ignorePaths": [
    "timestamp",
    "meta.requestId", 
    "trips[].bookingId"
  ],
  "endpointConfig": {
    "/trips/upcoming": { "severity": "critical" },
    "/trips/*": { "severity": "critical" },
    "/destinations": { "severity": "normal" },
    "*": { "severity": "normal" }
  },
  "failOnWarnings": false
}`} />

            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p><strong>Key config:</strong></p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>baseUrl:</strong> Live API to check against (staging, not production)</li>
                <li><strong>ignorePaths:</strong> Skip timestamp, IDs, and ephemeral fields</li>
                <li><strong>endpointConfig:</strong> Set severity per endpoint (critical fails CI; normal warns only)</li>
                <li><strong>Wildcards:</strong> <code className="bg-muted px-1 rounded">*</code> matches one path segment (<code className="bg-muted px-1 rounded">/trips/*</code> matches <code className="bg-muted px-1 rounded">/trips/123</code>)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="run-it">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Run Drift Check</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Command Line</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock language="bash" code={`# Zero-config: uses mockifyer.drift.json
npx mockifyer-drift-check

# Override scenario and baseUrl
npx mockifyer-drift-check \\
  --scenario drift-watch \\
  --base-url https://staging.wanderweird.dev \\
  --header "Authorization: Bearer $API_TOKEN"

# Fail on warnings (not just breaking changes)
npx mockifyer-drift-check --fail-on-warnings`} />

            <div>
              <h4 className="font-semibold mb-2 text-sm">Sample Output</h4>
              <CodeBlock language="bash" code={`✗ 2 of 24 mocks drifted: 1 breaking, 1 warning

Drifted mocks:

  BREAKING GET https://staging.wanderweird.dev/trips/123
  File: mock-data/drift-watch/staging.wanderweird.dev/trips/GET_123.json
    ✗ - name (string)
    ✗ ~ id: number → string

  WARNING GET https://staging.wanderweird.dev/destinations
  File: mock-data/drift-watch/staging.wanderweird.dev/destinations/GET.json
    ⚠ + country (string)

→ Breaking changes detected. Review and update your mocks.`} />
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-semibold">Exit Codes</p>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li><code className="bg-muted px-1 rounded">0</code> — No drift (or warnings only)</li>
                <li><code className="bg-muted px-1 rounded">1</code> — Breaking drift (or any drift with <code className="bg-muted px-1 rounded">--fail-on-warnings</code>)</li>
                <li><code className="bg-muted px-1 rounded">2</code> — Error (no mocks found, invalid args)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-sm">JSON Output</h4>
              <CodeBlock language="bash" code={`npx mockifyer-drift-check --json > drift-report.json`} />
              <p className="text-sm text-muted-foreground mt-2">
                JSON mode outputs a structured report for CI integration. See <code className="bg-muted px-1 rounded">docs/examples/drift-nightly.yml</code> for a full example.
              </p>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-3 text-sm">CLI Workflow Demo</h4>
              <div className="rounded-lg border overflow-hidden bg-muted/30">
                <img 
                  src="/videos/drift-demo/drift-cli-demo.gif" 
                  alt="Terminal demo: drift check v1 passes, v2 fails with breaking changes, accept and accept-all-warnings fix drift, final check passes"
                  className="w-full"
                  loading="lazy"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Terminal: Check v1 ✓ (exit 0) → Check v2 ✗ (breaking drift, exit 1) → 
                <code className="bg-muted px-1 rounded">--accept</code> endpoint → 
                <code className="bg-muted px-1 rounded">--accept-all-warnings</code> → 
                Check v2 ✓ (exit 0)
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="nightly-ci">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          <Clock className="inline-block h-7 w-7 mr-2 mb-1" />
          Nightly CI with GitHub Actions
        </h2>
        
        <p className="text-muted-foreground mb-4">
          Run drift check nightly in CI. When breaking changes are detected, GitHub opens <strong>one</strong> issue 
          labeled <code className="bg-muted px-1 rounded">api-drift</code> with a summary and copy-paste fix commands.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Copy-Paste Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Save as <code className="bg-muted px-1 rounded">.github/workflows/drift-check.yml</code> 
              (full example: <code className="bg-muted px-1 rounded">docs/examples/drift-nightly.yml</code>):
            </p>

            <CodeBlock language="yaml" code={`name: API Drift Check

on:
  schedule:
    - cron: '0 3 * * *'  # Nightly at 3am UTC
  workflow_dispatch:      # Manual trigger

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run drift check
        run: |
          npx mockifyer-drift-check \\
            --scenario drift-watch \\
            --header "Authorization: Bearer \${{ secrets.API_TOKEN }}" \\
            --json > drift-report.json
      
      # Parse report and create/update GitHub issue...
      # See docs/examples/drift-nightly.yml for full workflow`} />

            <div className="space-y-2 text-sm">
              <p className="font-semibold">What it does:</p>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>Runs nightly at 3am UTC</li>
                <li>Creates/updates <strong>one</strong> issue labeled <code className="bg-muted px-1 rounded">api-drift</code></li>
                <li>Lists all drifted endpoints with their issues</li>
                <li>Provides copy-paste commands to accept or ignore drift</li>
                <li>Closes the issue when drift is resolved</li>
                <li>Fails the workflow on breaking drift</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="fix-drift">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Fix Drift</h2>
        
        <p className="text-muted-foreground mb-4">
          When CI reports drift, you have several options. The goal is to update your mocks or config, 
          then review the <code className="bg-muted px-1 rounded">git diff</code> in a PR.
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>CLI: Accept or Ignore</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">Accept a specific endpoint (re-records from live):</p>
                <CodeBlock language="bash" code={`# Future: these commands are planned but not yet in the CLI
# npx mockifyer-drift-check --accept "GET /trips/123"
# npx mockifyer-drift-check --accept-all-warnings`} />
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Note:</strong> Accept/ignore commands are <strong>not yet implemented</strong> in the CLI. 
                  For now, manually re-record or edit mocks, then review the git diff.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Ignore a field that changes frequently:</p>
                <CodeBlock language="bash" code={`# Add to mockifyer.drift.json ignorePaths:
{
  "ignorePaths": ["timestamp", "trips[].bookingId"]
}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardHeader>
              <CardTitle>Dashboard Drift Tab</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The Mockifyer dashboard includes a Drift tab at <code className="bg-muted px-1 rounded">http://localhost:3002/drift</code> with:
              </p>

              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li><strong>Stats cards:</strong> Total mocks, breaking drift, warnings, last check time</li>
                <li><strong>Endpoint list:</strong> Each with status badge (Breaking, Warning, OK, Snoozed)</li>
                <li><strong>Issue details:</strong> Path, message, first/last seen, occurrences</li>
                <li><strong>Actions per endpoint:</strong>
                  <ul className="ml-6 mt-1 space-y-1 list-circle list-inside">
                    <li><strong>Accept Live:</strong> Re-fetch from live API and update mock file</li>
                    <li><strong>Ignore Field:</strong> Add to ignorePaths in config</li>
                    <li><strong>Snooze:</strong> Suppress warnings for N days</li>
                  </ul>
                </li>
                <li><strong>Bulk action:</strong> "Accept All Warnings" for non-breaking changes</li>
                <li><strong>History:</strong> Recent drift checks with timestamps and status</li>
              </ul>

              <p className="text-sm text-muted-foreground mt-3">
                After accepting drift, the dashboard shows a git diff so you can review what changed before committing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual Re-Record (Without the CLI)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you prefer manual control, re-record the drifted endpoints and diff the old vs new mocks:
              </p>

              <CodeBlock language="bash" code={`# 1. Record to a new scenario
MOCKIFYER_SCENARIO=drift-watch-new MOCKIFYER_RECORD=true npm run dev

# 2. Trigger the drifted endpoints (click through app or run tests)

# 3. Diff the scenarios
diff -u mock-data/drift-watch/staging.wanderweird.dev/trips/GET_123.json \\
        mock-data/drift-watch-new/staging.wanderweird.dev/trips/GET_123.json`} />

              <p className="text-sm text-muted-foreground">
                Review the diff. If it's an expected API change, copy the new mock to <code className="bg-muted px-1 rounded">drift-watch/</code> and commit.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="drift-history">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Drift History in .drift/</h2>
        
        <p className="text-muted-foreground mb-4">
          Each time drift check runs, it writes <code className="bg-muted px-1 rounded">.drift/reports/&lt;timestamp&gt;.json</code>. 
          This history helps you see when drift first appeared and how long it's been around.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>What the History Tells You</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Example report excerpt:</p>
              <CodeBlock language="json" code={`{
  "timestamp": "2026-11-13T03:00:15.234Z",
  "mockReports": [
    {
      "method": "GET",
      "url": "https://staging.wanderweird.dev/trips/123",
      "hasDrift": true,
      "hasBreakingDrift": true,
      "issues": [
        {
          "path": "name",
          "type": "missing_key",
          "severity": "breaking",
          "firstSeen": "2026-11-10T03:00:12Z",
          "lastSeen": "2026-11-13T03:00:15Z",
          "occurrences": 4
        }
      ]
    }
  ]
}`} />
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-semibold">Key fields:</p>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>firstSeen:</strong> When this drift first appeared (helps identify when the API changed)</li>
                <li><strong>lastSeen:</strong> Most recent check that saw this drift</li>
                <li><strong>occurrences:</strong> How many times drift check has seen this issue</li>
              </ul>

              <p className="text-muted-foreground mt-3">
                If <code className="bg-muted px-1 rounded">firstSeen</code> was 3 days ago and <code className="bg-muted px-1 rounded">occurrences</code> is 3, 
                the API likely changed 3 days ago and has been stable since.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="p-4 border border-blue-500/50 bg-blue-500/10 rounded-md">
          <p className="text-blue-900 dark:text-blue-200 text-sm">
            <strong>Tip:</strong> Add <code className="bg-muted px-1 rounded">.drift/</code> to <code className="bg-muted px-1 rounded">.gitignore</code> if you 
            run drift check locally. For CI-only drift checks, you can skip it (reports only exist on the CI runner).
          </p>
        </div>
      </section>

      <section id="cli-availability">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">CLI Availability</h2>
        
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3">
              The <code className="bg-muted px-1 rounded">mockifyer-drift-check</code> CLI is available in 
              <code className="bg-muted px-1 rounded">@sgedda/mockifyer-core</code> ≥1.10.194.
            </p>

            <p className="text-sm text-muted-foreground mb-3">
              The dashboard Drift tab is available in 
              <code className="bg-muted px-1 rounded">@sgedda/mockifyer-dashboard</code> ≥1.5.97.
            </p>

            <CodeBlock language="bash" code={`# Check installed version
npm list @sgedda/mockifyer-core

# Upgrade to latest:
npm install @sgedda/mockifyer-core@latest

# For dashboard drift features:
npm install @sgedda/mockifyer-dashboard@latest`} />
          </CardContent>
        </Card>
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

          <a href="https://github.com/sgedda/mockifyer/blob/main/docs/DRIFT_CHECK.md" target="_blank" rel="noopener noreferrer">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Full CLI Reference</h3>
                <p className="text-sm text-muted-foreground">
                  Complete documentation for mockifyer-drift-check (GitHub)
                </p>
              </CardContent>
            </Card>
          </a>
        </div>
      </section>
    </div>
  )
}
