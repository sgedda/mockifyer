import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import QuickStartBox from '@/components/QuickStartBox'

export default function MockAtTheNetworkEdge() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" id="mock-at-the-network-edge">
          Mock at the Network Edge
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Your tests pass but bugs ship: mock only at the network boundary, not your own code
        </p>
      </header>

      <QuickStartBox variant="node-fetch" />

      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md mb-6">
        <p className="text-sm text-muted-foreground">
          <strong>Already ran <code className="bg-muted px-1 rounded">npx mockifyer init</code>?</strong> Skip to <a href="#the-principle" className="text-primary hover:underline">The Principle</a> if you've set up Mockifyer recording.
        </p>
      </div>

      <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200 text-sm">
            <strong>The Problem:</strong> Tests that mock hooks, components, or utility functions test implementation details, 
            not what the user sees. When you refactor, tests break even though behavior is unchanged. When real APIs change shape, tests stay green.
          </div>
        </div>
      </div>

      <section id="the-principle">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">The Principle</h2>
        <p className="text-muted-foreground mb-4">
          <strong>Mock what leaves your process</strong> (HTTP requests), not what stays inside it (hooks, components, parsers). 
          This gives you:
        </p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <span><strong>Tests that survive refactors</strong> — change your hook internals, tests still pass if the user experience is the same</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <span><strong>Real response shapes</strong> — recorded from actual APIs, so breaking changes surface as test failures</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <span><strong>Confidence in integration</strong> — your components, hooks, and data flow all run for real; only the network is stubbed</span>
          </li>
        </ul>
      </section>

      <section id="what-not-to-mock">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">What Not To Mock</h2>
        
        <Card className="border-red-500/50 bg-red-500/5 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              Brittle: Mocking Hooks and Components
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock language="typescript" code={`// ❌ Brittle: mocks implementation details
import { useFetchTrips } from './hooks/useFetchTrips';

jest.mock('./hooks/useFetchTrips');

test('shows trips', () => {
  (useFetchTrips as jest.Mock).mockReturnValue({
    data: [{ id: 1, name: 'Paris' }],
    loading: false
  });
  
  render(<TripList />);
  expect(screen.getByText('Paris')).toBeInTheDocument();
});

// 🔧 Refactor the hook → test breaks
// 🔧 Rename useFetchTrips → test breaks  
// ⚠️ API changes {name} to {title} → test stays green (false positive)`} />
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Robust: Mocking HTTP at the Network Edge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock language="typescript" code={`// ✅ Robust: mocks the HTTP boundary
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false, // replay recorded responses
  scenarios: { default: 'trips-with-data' }
});

test('shows trips', async () => {
  render(<TripList />);
  
  // useFetchTrips runs for real, calls fetch()
  // fetch is intercepted and returns recorded response
  await waitFor(() => {
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });
});

// ✅ Refactor the hook → test still passes
// ✅ Rename useFetchTrips → test still passes
// ✅ API changes {name} to {title} → test fails (catches the bug)`} />
          </CardContent>
        </Card>
      </section>

      <section id="record-real-responses">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Record Real Responses</h2>
        <p className="text-muted-foreground mb-4">
          Record once from the live API, then replay in tests. This captures the actual response shape, 
          including edge cases you might forget to write by hand.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Recording Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. Enable recording mode</h4>
              <CodeBlock language="bash" code={`MOCKIFYER_RECORD=true npm run dev`} />
              <p className="text-sm text-muted-foreground mt-2">
                Requests land as request-only stubs in <code className="text-xs bg-muted px-1 py-0.5 rounded">_scratch/</code> and keep hitting the live API until you activate them. Choose which requests to record via domain-path rules or by unticking "Always use live API" in the dashboard for each mock.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Use the app to trigger real API calls</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Click through your app normally. Each fetch/axios request is captured as a request-only stub in <code className="bg-muted px-1 rounded">_scratch/</code>. Open the dashboard, find the requests, and activate the ones you want to replay by unticking "Always use live API."
              </p>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md mt-4">
              <h4 className="font-semibold mb-2 text-blue-400">💡 Quick Demo: Capture Everything</h4>
              <p className="text-sm text-muted-foreground mb-2">
                For demos or quick experiments, you can record all responses immediately (heavy):
              </p>
              <CodeBlock language="bash" code={`MOCKIFYER_RECORD_RESPONSES=true \\
MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false \\
npm run dev`} />
              <p className="text-sm text-muted-foreground mt-2">
                Or in code: <code className="text-xs bg-muted px-1 py-0.5 rounded">recordResponses: true</code> and <code className="text-xs bg-muted px-1 py-0.5 rounded">domainPathRulesMode: 'record_all'</code>. See <code className="text-xs bg-muted px-1 py-0.5 rounded">demos/record-replay-basics/record.js</code> for an example.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Organize into scenarios</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Create scenario folders for different states:
              </p>
              <CodeBlock language="bash" code={`mock-data/
  trips-empty/           # No trips yet
  trips-with-data/       # Happy path with 3 trips  
  trips-error-500/       # Server error
  trips-slow-network/    # Same data, 5-second delay`} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="test-edge-cases">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Test Error, Empty, and Slow Cases</h2>
        <p className="text-muted-foreground mb-4">
          Real apps need to handle errors, empty states, and slow networks. With Mockifyer, you can 
          create scenarios for each case and switch between them in tests.
        </p>

        <CodeBlock language="typescript" code={`import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('TripList', () => {
  test('shows empty state', async () => {
    setupMockifyer({
      mockDataPath: './mock-data',
      scenarios: { default: 'trips-empty' }
    });
    
    render(<TripList />);
    await waitFor(() => {
      expect(screen.getByText('No trips yet')).toBeInTheDocument();
    });
  });

  test('shows error message', async () => {
    setupMockifyer({
      mockDataPath: './mock-data',
      scenarios: { default: 'trips-error-500' }
    });
    
    render(<TripList />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load trips')).toBeInTheDocument();
    });
  });

  test('shows loading state then data', async () => {
    setupMockifyer({
      mockDataPath: './mock-data',
      scenarios: { default: 'trips-slow-network' }
    });
    
    render(<TripList />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    }, { timeout: 6000 });
  });
});`} />
      </section>

      <section id="mockifyer-scenarios">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">How Mockifyer Does It</h2>
        <p className="text-muted-foreground mb-4">
          Mockifyer intercepts <code className="bg-muted px-1 rounded">fetch()</code> and <code className="bg-muted px-1 rounded">axios()</code> at 
          the network edge, before requests leave your process. Your components, hooks, and parsers all run for real.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Setup Example (React Native / Expo)</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock language="typescript" code={`import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';

// In app startup (App.tsx or _layout.tsx)
await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  recordMode: __DEV__ && process.env.MOCKIFYER_RECORD === 'true',
  scenarios: {
    default: 'trips-with-data' // or trips-empty, trips-error-500, etc.
  }
});

// Now all fetch() calls are intercepted
// Your hooks, components, and state management run unchanged`} />
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
                  Install Mockifyer and set up your first recorded scenario
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/guides/stable-react-native-e2e">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Stable React Native E2E Tests</h3>
                <p className="text-sm text-muted-foreground">
                  Stop Detox/Appium/Maestro flakes by making the backend deterministic
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/e2e-tutorial">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">E2E Tutorial</h3>
                <p className="text-sm text-muted-foreground">
                  Walk through the WanderWeird demo with Playwright tests
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  )
}
