import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, Calendar, Database } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import QuickStartBox from '@/components/QuickStartBox'

export default function StableReactNativeE2E() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" id="stable-react-native-e2e">
          Stable React Native E2E Tests
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Stop Detox, Appium, and Maestro flakes by making the backend deterministic
        </p>
      </header>

      <QuickStartBox variant="react-native-fetch" />

      <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200 text-sm">
            <strong>The Problem:</strong> Your Detox tests pass locally but fail in CI. The "no trips" test finds trips. 
            The "shows error message" test sees success. Dates drift, data disappears, and every re-run is different.
          </div>
        </div>
      </div>

      <section id="the-solution">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">The Solution: Deterministic Backend</h2>
        <p className="text-muted-foreground mb-4">
          Instead of testing against a live API (where data changes unpredictably), mock the HTTP layer and lock each test to a specific scenario.
        </p>

        <div className="grid md:grid-cols-2 gap-6 my-6">
          <Card className="border-red-500/50 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-lg">Flaky: Live API</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>✗ Data changes between runs</p>
              <p>✗ Dates drift (today, tomorrow)</p>
              <p>✗ Network timeouts</p>
              <p>✗ Different data in CI vs local</p>
              <p>✗ Hard to test error states</p>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Stable: Mocked Backend</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Same data every run
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Fixed dates (frozen time)
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Instant responses (no network)
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Identical in CI and local
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Easy error/empty states
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="scenarios-for-states">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Scenarios for Every State</h2>
        <p className="text-muted-foreground mb-4">
          Create a scenario folder for each state you need to test: empty, logged-out, error, slow network, etc. 
          Each scenario is a complete set of mocks.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Example Scenario Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="bash" code={`mock-data/
  trips-empty/
    demo.devxtools.dev/tasks/GET_2026-11-10_00-00-00.json  → { "response": { "data": [] } }
  
  trips-with-data/
    demo.devxtools.dev/tasks/GET_2026-11-10_15-34-10.json  → { "response": { "data": [{...}, {...}] } }
    demo.devxtools.dev/tasks/1/GET_2026-11-10_15-34-10.json → { "response": { "data": { "id": 1, "title": "..." } } }
  
  trips-error-500/
    demo.devxtools.dev/tasks/GET_2026-11-10_00-00-00.json  → status 500 via statusOverride
  
  trips-logged-out/
    demo.devxtools.dev/tasks/GET_2026-11-10_00-00-00.json  → status 401 via statusOverride
  
  trips-slow-network/
    demo.devxtools.dev/tasks/GET_2026-11-10_15-34-10.json  → same data, but 5-second delay via responseDelayMs`} />
          </CardContent>
        </Card>
      </section>

      <section id="launch-arguments">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Lock the Scenario with Launch Arguments</h2>
        <p className="text-muted-foreground mb-4">
          Pass the scenario name as a launch argument when starting the app. Mockifyer reads it automatically and locks 
          the backend to that scenario for the entire test session.
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detox Example</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock language="javascript" code={`// e2e/tests/trips.test.js
describe('Trip List', () => {
  beforeEach(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        scenario: 'trips-empty', // ← locks Mockifyer to this scenario
        mockifyerClientId: 'detox-test'
      }
    });
  });

  it('shows empty state', async () => {
    await expect(element(by.text('No trips yet'))).toBeVisible();
  });
});

describe('Trip Details', () => {
  beforeEach(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        scenario: 'trips-with-data', // ← different scenario
        mockifyerClientId: 'detox-test'
      }
    });
  });

  it('shows trip name', async () => {
    await element(by.id('trip-123')).tap();
    await expect(element(by.text('Paris'))).toBeVisible();
  });
});`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maestro Example</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock language="yaml" code={`# trips-empty.yaml
appId: com.example.app
---
- launchApp:
    arguments:
      scenario: trips-empty
      mockifyerClientId: maestro-test

- assertVisible: "No trips yet"

# trips-error.yaml  
appId: com.example.app
---
- launchApp:
    arguments:
      scenario: trips-error-500
      mockifyerClientId: maestro-test

- assertVisible: "Failed to load trips"`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appium Example</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock language="javascript" code={`const wdio = require('webdriverio');

const opts = {
  capabilities: {
    platformName: 'iOS',
    'appium:app': '/path/to/app.app',
    'appium:launchArguments': [
      '-scenario', 'trips-empty',
      '-mockifyerClientId', 'appium-test'
    ]
  }
};

const client = await wdio.remote(opts);
// App launches with trips-empty scenario locked`} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="fixed-dates">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Fixed Dates for Time-Dependent Tests</h2>
        <p className="text-muted-foreground mb-4">
          If your app shows "Check-in opens today" or "2 days until trip", freezing the date makes those tests stable. 
          Pass a fixed date in the launch arguments or scenario config.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date Freezing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Option 1: Date Config in Setup</h4>
              <CodeBlock language="typescript" code={`await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: './mock-data',
  bundledDataPath: './assets/mock-data',
  config: {
    dateManipulation: {
      fixedDate: "2024-12-20T00:00:00Z",
      timezone: "America/New_York"
    }
  }
});

// getCurrentDate() now returns Dec 20, 2024`} />
              <p className="text-sm text-muted-foreground mt-2">
                You can also use per-scenario <code className="text-xs bg-muted px-1 rounded">date-config.json</code> files, but they require 
                setting <code className="text-xs bg-muted px-1 rounded">disableDateConfigFileFallback: false</code> in config (it defaults to true).
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Option 2: Node Environment Variable</h4>
              <CodeBlock language="bash" code={`MOCKIFYER_DATE='2024-12-20T00:00:00Z' npm test

// Or use client-lane dates in the dashboard (per-lane override)`} />
            </div>

            <div>
              <h4 className="font-semibold mb-2">In Your App Code</h4>
              <CodeBlock language="typescript" code={`import { getCurrentDate } from '@sgedda/mockifyer-core';

// ❌ Don't use Date.now() or new Date() directly
const now = Date.now();

// ✅ Use getCurrentDate() instead
import { getCurrentDate } from '@sgedda/mockifyer-core';
const now = getCurrentDate().getTime();

// With dateManipulation.fixedDate or MOCKIFYER_DATE, this returns the frozen date
// When not set, it returns the real current time`} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="setup-in-app">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Setup in App Startup</h2>
        <p className="text-muted-foreground mb-4">
          Configure Mockifyer once at app startup. The <code className="bg-muted px-1 rounded">MOCKIFYER_MODE=launch_client</code> setting 
          ensures Mockifyer only activates when launch arguments are present (so production builds stay clean).
        </p>

        <Card>
          <CardHeader>
            <CardTitle>App.tsx / _layout.tsx</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="typescript" code={`import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

// In app startup
await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  recordMode: false, // E2E tests replay, don't record
  
  // Only activate when launch args include scenario or mockifyerClientId
  // Production builds with no launch args stay clean
  runtimeMode: process.env.MOCKIFYER_MODE || 'launch_client'
});

// That's it! Launch arguments control everything else:
// - scenario: which mocks to use
// - mockifyerClientId: client lane (optional)
// For dates, use dateManipulation in config or MOCKIFYER_DATE env var`} />
          </CardContent>
        </Card>
      </section>

      <section id="learn-more">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Learn More</h2>
        <div className="grid gap-4">
          <a 
            href="https://github.com/sgedda/mockifyer/tree/main/example-projects/wanderweird-travel"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">WanderWeird Demo App</h3>
                <p className="text-sm text-muted-foreground">
                  Full-stack Expo + multi-service example with scenarios, launch arguments, and E2E tests
                </p>
              </CardContent>
            </Card>
          </a>

          <Link to="/e2e-tutorial">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">E2E Tutorial</h3>
                <p className="text-sm text-muted-foreground">
                  Walk through the Playwright E2E suite against the WanderWeird stack
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/getting-started">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-sm text-muted-foreground">
                  Install Mockifyer and set up your first scenario
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  )
}
