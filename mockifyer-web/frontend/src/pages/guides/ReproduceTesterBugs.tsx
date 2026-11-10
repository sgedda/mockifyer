import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Terminal, Network, Code2 } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import QuickStartBox from '@/components/QuickStartBox'

export default function ReproduceTesterBugs() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" id="reproduce-tester-bugs">
          Reproduce Tester Bugs Locally
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          When a non-technical tester reports a bug, capture the API calls behind it and replay them on your machine
        </p>
      </header>

      <QuickStartBox variant="node-fetch" />

      <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200 text-sm">
            <strong>The Problem:</strong> A tester says "the trip details are wrong" but you can't reproduce it. 
            You don't know which endpoint failed, what the backend returned, or how your app parsed it.
          </div>
        </div>
      </div>

      <section id="the-workflow">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">The Workflow</h2>
        <p className="text-muted-foreground mb-4">
          When a tester has Mockifyer running in development/staging builds, their HTTP traffic is logged to the dashboard. 
          You can then:
        </p>
        <ol className="space-y-3 text-muted-foreground list-decimal list-inside">
          <li><strong>View the Network trace</strong> in the dashboard — see every request they made</li>
          <li><strong>Follow request chains</strong> across services via <code className="bg-muted px-1 rounded">x-mockifyer-request-id</code> headers</li>
          <li><strong>Export as curl</strong> to test the backend directly from your terminal</li>
          <li><strong>Save as a scenario</strong> and replay it locally so the bug reproduces every time</li>
        </ol>
      </section>

      <div className="p-4 border border-blue-500/50 bg-blue-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-blue-900 dark:text-blue-200 text-sm">
            <strong>Limitation:</strong> This workflow requires the tester's app to be connected to the shared dashboard 
            (via <code className="bg-muted px-1 rounded">MOCKIFYER_DASHBOARD_URL</code>). 
            For production builds or devices you can't instrument, you'll need traditional logging or APM tools.
          </div>
        </div>
      </div>

      <section id="network-trace">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">1. View the Network Trace</h2>
        <p className="text-muted-foreground mb-4">
          The dashboard's <strong>Network</strong> page shows every HTTP request, with filtering by client, scenario, and time range.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Dashboard Network View
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Open <code className="bg-muted px-1 rounded">http://localhost:3002/network</code> and filter by:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• <strong>Client ID</strong>: The tester's device (e.g. <code className="bg-muted px-1 rounded">tester-iphone-13</code>)</li>
              <li>• <strong>Scenario</strong>: The test scenario they were running</li>
              <li>• <strong>Time</strong>: When the bug occurred</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              Each row shows the HTTP method, URL, status code, duration, and whether it was a <strong>Hit</strong> (served from mock) 
              or <strong>Miss</strong> (called the real API).
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="trace-across-services">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">2. Trace Requests Across Services</h2>
        <p className="text-muted-foreground mb-4">
          When one service calls another, Mockifyer links them via <code className="bg-muted px-1 rounded">x-mockifyer-request-id</code> and 
          <code className="bg-muted px-1 rounded ml-1">x-mockifyer-parent-request-id</code> headers. 
          The dashboard shows the full chain.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Request Correlation Example</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="text" code={`App → Gateway (GET /trips/123)
       x-mockifyer-request-id: req_abc123
  ↓
  Gateway → TripService (GET /api/trips/123)
             x-mockifyer-request-id: req_def456
             x-mockifyer-parent-request-id: req_abc123
    ↓
    TripService → WeatherAPI (GET /forecast?lat=48.8&lon=2.3)
                   x-mockifyer-request-id: req_ghi789
                   x-mockifyer-parent-request-id: req_def456`} />
            <p className="text-sm text-muted-foreground mt-4">
              Click any request in the Network view to see its parent and children. This shows exactly which backend call failed 
              and how the error propagated.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="export-as-curl">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">3. Export as curl</h2>
        <p className="text-muted-foreground mb-4">
          Copy any request as a curl command to test the backend directly from your terminal. This is useful for:
        </p>
        <ul className="text-muted-foreground space-y-2 mb-4">
          <li>• Verifying the backend's current behavior</li>
          <li>• Sharing reproduction steps with the backend team</li>
          <li>• Testing auth tokens and headers in isolation</li>
        </ul>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Example curl Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="bash" code={`curl -X GET 'https://api.example.com/trips/123' \\
  -H 'Authorization: Bearer eyJhbGc...' \\
  -H 'x-mockifyer-client-id: tester-iphone-13' \\
  -H 'x-mockifyer-request-id: req_abc123' \\
  -H 'Accept: application/json'`} />
            <p className="text-sm text-muted-foreground mt-4">
              Run this in your terminal to see the exact response the tester's device received.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="save-as-scenario">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">4. Save as a Scenario</h2>
        <p className="text-muted-foreground mb-4">
          Once you've found the problematic request, save its response as a new scenario. Now you can reproduce the bug 
          locally every time.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>From Dashboard to Local Scenario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. Find the request in Network view</h4>
              <p className="text-sm text-muted-foreground">
                Filter by client ID and time, click the problematic request.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Copy the response JSON</h4>
              <p className="text-sm text-muted-foreground">
                The dashboard shows the full request and response. Copy the response body.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Save to a scenario folder</h4>
              <CodeBlock language="bash" code={`mkdir -p mock-data/bug-trip-wrong-price
cp mock-data/default/trips_123_GET.json \\
   mock-data/bug-trip-wrong-price/

# Edit the JSON to match what the tester saw`} />
            </div>

            <div>
              <h4 className="font-semibold mb-2">4. Replay locally</h4>
              <CodeBlock language="typescript" code={`setupMockifyer({
  mockDataPath: './mock-data',
  scenarios: { default: 'bug-trip-wrong-price' }
});

// Now fetch('/trips/123') returns the buggy response`} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="atlas-metro">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Atlas Trace (React Native / Metro)</h2>
        <p className="text-muted-foreground mb-4">
          In development, press <kbd className="px-2 py-1 bg-muted border rounded text-sm font-mono">t</kbd> in the Metro terminal 
          to open <strong>Atlas</strong> — an interactive trace of all HTTP requests, with syntax-highlighted JSON and request/response correlation.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Atlas Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• <strong>Live trace</strong>: See requests as they happen</li>
              <li>• <strong>Syntax highlighting</strong>: JSON requests/responses with collapsible trees</li>
              <li>• <strong>Request chaining</strong>: Follow parent/child relationships across services</li>
              <li>• <strong>curl export</strong>: Copy any request as a curl command</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              Atlas runs in your Metro bundler (not on the device), so it works even if the tester doesn't have access to the dashboard.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="learn-more">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Learn More</h2>
        <div className="grid gap-4">
          <Link to="/dashboard">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Dashboard Documentation</h3>
                <p className="text-sm text-muted-foreground">
                  Full guide to the Network view, Atlas tracing, and request correlation
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/e2e-tutorial">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">E2E Tutorial</h3>
                <p className="text-sm text-muted-foreground">
                  Walk through tracing and scenario switching in the WanderWeird demo
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/guides/stable-react-native-e2e">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Stable E2E Tests</h3>
                <p className="text-sm text-muted-foreground">
                  Use scenarios to make Detox/Appium/Maestro tests deterministic
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  )
}
