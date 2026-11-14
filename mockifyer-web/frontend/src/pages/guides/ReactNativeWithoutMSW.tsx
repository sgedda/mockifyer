import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import QuickStartBox from '@/components/QuickStartBox'

export default function ReactNativeWithoutMSW() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" id="react-native-without-msw">
          Mocking APIs in React Native: Handlers vs Recording
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          MSW uses in-code handlers. Mockifyer records real traffic. Compare workflows and choose what fits.
        </p>
      </header>

      <div className="p-4 border border-blue-500/50 bg-blue-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-blue-900 dark:text-blue-200 text-sm">
            <strong>About MSW:</strong> MSW supports React Native via <code className="bg-muted px-1 rounded">msw/native</code> with polyfills. 
            It uses in-code handlers you write. Mockifyer is a different approach: record real API responses once, store JSON mocks in your repo, 
            switch scenarios, and optionally use Maestro launch arguments to pick scenarios per test. Choose based on your workflow.
          </div>
        </div>
      </div>

      <QuickStartBox variant="react-native-fetch" />

      <section id="comparison">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">MSW vs Mockifyer Trade-offs</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">MSW (msw/native)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>Approach:</strong> Write handlers in code. Install polyfills for Node APIs.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Full control over response logic</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Type-safe with TypeScript</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span>Must write handlers for every endpoint</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span>Handlers can drift from real API shapes</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mockifyer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>Approach:</strong> Record real API traffic once, replay JSON mocks.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Mocks match actual API responses</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Scenarios: switch mock sets per test</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Dashboard for runtime editing</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Maestro launch args to pick scenarios</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="setup">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Setup</h2>

        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md mb-6">
          <p className="text-sm text-muted-foreground">
            <strong>Already ran <code className="bg-muted px-1 rounded">npx mockifyer init</code>?</strong> Skip to <a href="#recording" className="text-primary hover:underline">Recording</a> if you've installed Mockifyer and added the setup code to your app.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-3">1. Install</h3>
            <CodeBlock language="bash" code="npm install --save-dev @sgedda/mockifyer-fetch" />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">2. Configure Metro</h3>
            <p className="text-muted-foreground mb-3">
              Metro needs to stub Node.js built-in modules (<code className="bg-muted px-1 rounded text-xs">fs</code>, <code className="bg-muted px-1 rounded text-xs">path</code>) that aren't available in React Native:
            </p>
            <CodeBlock 
              language="javascript" 
              code={`// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

const config = getDefaultConfig(__dirname);
module.exports = configureMetroForMockifyer(config);`} 
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">3. Create Setup File</h3>
            <CodeBlock 
              language="typescript" 
              code={`// mockifyer-setup.ts
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  recordMode: __DEV__ && process.env.EXPO_PUBLIC_MOCKIFYER_RECORD === 'true',
  useGlobalFetch: true,
});`} 
            />
            <p className="text-sm text-muted-foreground mt-3">
              This uses <strong>selective recording</strong>: requests land as request-only stubs in <code className="bg-muted px-1 rounded text-xs">_scratch</code> and stay on the live API until you activate them in the dashboard.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">4. Import Before App</h3>
            <CodeBlock 
              language="typescript" 
              code={`// App.tsx
import './mockifyer-setup'; // ← Import first
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  // Your app code
}`} 
            />
          </div>
        </div>
      </section>

      <section id="recording">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Recording</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-3">Selective Recording (Default)</h3>
            <CodeBlock 
              language="bash" 
              code="EXPO_PUBLIC_MOCKIFYER_RECORD=true npx expo start" 
            />
            <p className="text-muted-foreground mt-3">
              Run your app, navigate screens, trigger API calls. Requests land as request-only stubs in the <code className="bg-muted px-1 rounded text-xs">_scratch</code> scenario. 
              Calls stay on the live API until you activate mocks in the dashboard or via domain-path rules.
            </p>
          </div>

          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Quick Demo Mode (Capture-Everything)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                For quick demos or throwaway testing, capture full responses and replay immediately:
              </p>
              <CodeBlock 
                language="bash" 
                code="EXPO_PUBLIC_MOCKIFYER_RECORD=true EXPO_PUBLIC_MOCKIFYER_RECORD_RESPONSES=true npx expo start" 
              />
              <p className="text-sm text-muted-foreground">
                Or configure in setup:
              </p>
              <CodeBlock 
                language="typescript" 
                code={`process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';

setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  recordMode: true,
  domainPathRulesMode: 'record_all'
});`} 
              />
              <p className="text-sm text-muted-foreground">
                Heavy. Captures everything. See{' '}
                <a 
                  href="https://github.com/sgedda/mockifyer/tree/main/demos/record-replay-basics" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  demos/record-replay-basics
                </a>
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Syncing Mocks to Your Project
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                On <strong>iOS Simulator / Android Emulator</strong>: Recorded files live in the app sandbox. To sync them back to your project folder for version control:
              </p>
              <CodeBlock 
                language="bash" 
                code={`# Sync from simulator/emulator to ./mock-data/
npm run sync:mocks

# Or use Metro's HTTP endpoint
curl http://localhost:8081/mockifyer-sync`} 
              />
              <p className="text-sm text-muted-foreground">
                On <strong>physical devices</strong>: Recording requires the dashboard proxy connection. Start the dashboard with <code className="bg-muted px-1 rounded text-xs">npm run dashboard:redis</code> and configure{' '}
                <code className="bg-muted px-1 rounded text-xs">initMockifyerForReactNativeDashboard</code> in your setup.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="replay">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Replay</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-3">Turn Off Recording</h3>
            <CodeBlock 
              language="bash" 
              code="npx expo start" 
            />
            <p className="text-muted-foreground mt-3">
              Without <code className="bg-muted px-1 rounded text-xs">EXPO_PUBLIC_MOCKIFYER_RECORD=true</code>, Mockifyer replays from saved mocks instead of hitting real APIs.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">Production Builds</h3>
            <p className="text-muted-foreground mb-3">
              Bundle mocks into your production build so they're available without filesystem access:
            </p>
            <CodeBlock 
              language="typescript" 
              code={`// generate-build-data.ts
import * as fs from 'fs';
import * as path from 'path';

const mockDataPath = path.join(__dirname, 'mock-data');
const outputPath = path.join(__dirname, 'assets', 'mock-data.ts');

// Read all JSON files, transform to MockData format
const mocks = /* ... */;

fs.writeFileSync(
  outputPath,
  \`export const mockData = \${JSON.stringify(mocks, null, 2)} as const;\`
);`} 
            />
            <p className="text-muted-foreground mt-3">
              Then use <code className="bg-muted px-1 rounded text-xs">MemoryProvider</code> with the bundled data. See the{' '}
              <a 
                href="https://github.com/sgedda/mockifyer/tree/main/example-projects/react-native-expo-example" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                react-native-expo-example
              </a>
              {' '}for the full script.
            </p>
          </div>
        </div>
      </section>

      <section id="scenarios">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Scenarios</h2>

        <p className="text-muted-foreground mb-4">
          Scenarios let you maintain multiple mock sets (success, error, loading) and switch between them:
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-3">Recording into a Scenario</h3>
            <CodeBlock 
              language="bash" 
              code="EXPO_PUBLIC_MOCKIFYER_RECORD=true EXPO_PUBLIC_MOCKIFYER_SCENARIO=error-state npx expo start" 
            />
            <p className="text-muted-foreground mt-3">
              Mocks are saved to <code className="bg-muted px-1 rounded text-xs">mock-data/error-state/</code>
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">Replaying a Scenario</h3>
            <CodeBlock 
              language="bash" 
              code="EXPO_PUBLIC_MOCKIFYER_SCENARIO=error-state npx expo start" 
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">Runtime Scenario Switching</h3>
            <p className="text-muted-foreground mb-3">
              Use the optional <code className="bg-muted px-1 rounded text-xs">@sgedda/mockifyer-dashboard</code> to switch scenarios at runtime without restarting your app.
            </p>
          </div>
        </div>
      </section>

      <section id="dashboard">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Dashboard & Tooling</h2>

        <Card>
          <CardHeader>
            <CardTitle>Optional: Mockifyer Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The dashboard provides a local UI to browse mocks, edit responses, switch scenarios, and view request traces:
            </p>
            <CodeBlock 
              language="bash" 
              code={`npm install --save-dev @sgedda/mockifyer-dashboard

# Start dashboard
npx mockifyer-dashboard --provider filesystem --path ./mock-data`} 
            />
            <p className="text-muted-foreground">
              Visit <code className="bg-muted px-1 rounded text-xs">http://localhost:3002</code> to browse and edit mocks. Changes are written back to JSON files immediately.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="example">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Example Projects</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Simple Expo Example</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Basic Expo app demonstrating record, replay, scenarios, and production bundling.
              </p>
              <a 
                href="https://github.com/sgedda/mockifyer/tree/main/example-projects/react-native-expo-example" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full">
                  View on GitHub →
                </Button>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WanderWeird Travel App</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Full-stack Expo app with 7 Node services, Umbraco CMS, scenarios, and request tracing.
              </p>
              <a 
                href="https://github.com/sgedda/mockifyer/tree/main/example-projects/wanderweird-travel" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full">
                  View on GitHub →
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="next-steps">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Next Steps</h2>

        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/getting-started">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Full Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Complete setup guide, configuration reference, and advanced features
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/guides/stable-react-native-e2e">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Stable E2E Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Use recorded mocks for deterministic, fast E2E tests with Maestro
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/faq">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">FAQ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Common questions and troubleshooting tips
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  )
}
