import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Globe, CheckCircle2, XCircle, Code, Rocket, AlertCircle, Play } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function BrowserRecordReplay() {
  const [showStackBlitz, setShowStackBlitz] = useState(false)
  
  return (
    <div className="max-w-[900px] mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Globe className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Record and Replay HTTP in the Browser</h1>
        </div>
        <p className="text-muted-foreground">
          Use Mockifyer in browsers and Expo web apps with the memory provider and preloaded fixtures — zero Node.js dependencies
        </p>
      </div>

      <Card className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Browser Support Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Browser and Expo web support will be available in the next release. Until then, try the example from the repository to test these features.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>Install the packages from npm</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={`npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch`} language="bash" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup with Memory Provider</CardTitle>
          <CardDescription>Initialize Mockifyer with preloaded fixtures</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. Prepare Your Fixtures</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Create JSON files with your mock data:
            </p>
            <CodeBlock code={`// fixtures/api-rates.json
{
  "request": {
    "method": "GET",
    "url": "https://api.frankfurter.dev/v1/latest"
  },
  "response": {
    "status": 200,
    "data": {
      "base": "USD",
      "date": "2024-01-15",
      "rates": {
        "EUR": 0.92,
        "GBP": 0.79
      }
    },
    "headers": {
      "content-type": "application/json"
    }
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}`} language="json" />
          </div>

          <div>
            <h3 className="font-semibold mb-2">2. Initialize Mockifyer</h3>
            <CodeBlock code={`import { setupMockifyer } from '@sgedda/mockifyer-fetch'
import ratesFixture from './fixtures/api-rates.json'

setupMockifyer({
  mockDataPath: './mock-data',  // Required but unused with memory provider
  databaseProvider: {
    type: 'memory',
    options: {
      fixtures: [ratesFixture]  // Preload all fixtures at init
    }
  },
  recordMode: false,           // Recording requires Node.js
  failOnMissingMock: false,   // Allow unmocked requests to pass through
  useGlobalFetch: true        // Patch global fetch
})`} language="typescript" />
          </div>

          <div>
            <h3 className="font-semibold mb-2">3. Use Fetch Normally</h3>
            <CodeBlock code={`// Mocked request (has fixture)
const response = await fetch('https://api.frankfurter.dev/v1/latest')
const data = await response.json()
// Returns: { base: "USD", date: "2024-01-15", ... }

// Unmocked request (no fixture, goes to network if failOnMissingMock: false)
const ipResponse = await fetch('https://api.ipify.org?format=json')
const ipData = await ipResponse.json()
// Goes to real API`} language="typescript" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What Works in the Browser</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Memory provider with preloaded fixtures</strong>
                <p className="text-sm text-muted-foreground">Load all mocks at initialization time</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Global fetch patching</strong>
                <p className="text-sm text-muted-foreground">Intercept all fetch calls automatically</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Request matching</strong>
                <p className="text-sm text-muted-foreground">URL, method, headers, query params</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Scenario switching</strong>
                <p className="text-sm text-muted-foreground">Change fixtures at runtime via setClientId()</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Vite, webpack, Metro bundlers</strong>
                <p className="text-sm text-muted-foreground">Zero Node.js built-ins in browser bundle</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Browser Limitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>No recording mode</strong>
                <p className="text-sm text-muted-foreground">Cannot save responses to disk (use Node.js to record, then export fixtures)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Memory provider only</strong>
                <p className="text-sm text-muted-foreground">Filesystem, Redis, and SQLite providers require Node.js</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>All fixtures must be preloaded</strong>
                <p className="text-sm text-muted-foreground">Cannot dynamically load from disk</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong>No Atlas HTML generation</strong>
                <p className="text-sm text-muted-foreground">Request tracing limited to console</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Run the Example Locally
          </CardTitle>
          <CardDescription>Try the browser example from the repository</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock code={`git clone https://github.com/sgedda/mockifyer
cd mockifyer/example-projects/browser-vite
npm install
npm run dev
# Open http://localhost:5173`} language="bash" />
          <p className="text-sm text-muted-foreground">
            The example shows one mocked request (currency rates from fixture) and one unmocked request (IP lookup from network).
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Dashboard Backend Connectivity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Browser clients can connect to a Mockifyer dashboard backend for centralized mock management and Redis/SQLite storage.
            This feature is being added in <a href="https://github.com/sgedda/mockifyer/pull/500" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">PR #500</a> — stay tuned for the guide update.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bundler Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Vite</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Vite automatically uses the browser build via the <code>browser</code> field in package.json. No configuration needed.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Webpack 5</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Webpack 5 respects the <code>browser</code> field by default when targeting 'web'.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Metro (Expo / React Native Web)</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Metro uses the browser build automatically. See{' '}
              <code>example-projects/expo-web-demo</code> for a complete Expo web setup.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Rocket className="h-6 w-6" />
            <div>
              <CardTitle>Try the Live Example</CardTitle>
              <CardDescription>
                Open the browser example in StackBlitz to see Mockifyer running in your browser
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-500/50">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> This demo will work once browser support is published in the next release.
            </p>
          </div>
          
          <div className="flex gap-3">
            <a
              href="https://stackblitz.com/github/sgedda/mockifyer/tree/main/example-projects/browser-vite"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium text-sm"
            >
              <Play className="h-4 w-4" />
              Open in StackBlitz
            </a>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStackBlitz(!showStackBlitz)}
            >
              {showStackBlitz ? 'Hide' : 'Show'} Embedded Preview
            </Button>
          </div>

          {showStackBlitz && (
            <div className="border rounded-lg overflow-hidden" style={{ height: '500px' }}>
              <iframe
                src="https://stackblitz.com/github/sgedda/mockifyer/tree/main/example-projects/browser-vite?embed=1&view=preview"
                className="w-full h-full"
                title="Mockifyer Browser Example"
                allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-4 pt-4">
        <Link to="/getting-started" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          ← Back to Getting Started
        </Link>
        <Link to="/config-reference" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          Configuration Reference →
        </Link>
      </div>
    </div>
  )
}
