import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle2, Smartphone, Database } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import QuickStartBox from '@/components/QuickStartBox'
import { RN_GUIDE_FAQ } from '@/lib/rn-guide-faq'

export { RN_GUIDE_FAQ }

const TOC = [
  { href: '#why-mock', label: 'Why mock APIs (offline development)' },
  { href: '#options', label: 'Options: stubs, MSW, mock server, record-replay' },
  { href: '#mock-fetch-react-native', label: 'Mock fetch in React Native / Expo' },
  { href: '#mock-axios-react-native', label: 'Mock axios in React Native' },
  { href: '#record', label: 'Selective recording' },
  { href: '#replay-mix', label: 'Replay and mix mocked vs live' },
  { href: '#global-storage', label: 'Global storage / shared mocks' },
  { href: '#freeze-date', label: 'Freeze the date' },
  { href: '#dashboard', label: 'Dashboard reachability' },
  { href: '#drift-atlas', label: 'Drift detection and Atlas' },
  { href: '#e2e', label: 'E2E tests' },
  { href: '#faq', label: 'FAQ' },
  { href: '#next-steps', label: 'Next steps' },
] as const

export default function HowToMockApiCallsInReactNative() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/guides">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Guides
          </Button>
        </Link>
        <h1
          className="text-4xl sm:text-5xl font-semibold tracking-tight"
          id="how-to-mock-api-calls-in-react-native"
        >
          How to mock API calls in React Native
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Practical Expo API mocking for fetch and axios — handwritten stubs, MSW (
          <code className="bg-muted px-1 rounded text-sm">msw/native</code>), a React Native mock
          server, or record-and-replay — including shared global storage when devices cannot reach
          your laptop.
        </p>
      </header>

      <nav aria-label="On this page" className="rounded-md border border-border bg-muted/30 p-4">
        <p className="text-sm font-semibold mb-2">On this page</p>
        <ul className="text-sm text-muted-foreground space-y-1 columns-1 sm:columns-2 gap-6">
          {TOC.map((item) => (
            <li key={item.href} className="break-inside-avoid">
              <a href={item.href} className="text-primary hover:underline">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <QuickStartBox variant="react-native-fetch" />

      <section id="why-mock">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          Why mock APIs for offline development?
        </h2>
        <p className="text-muted-foreground mb-4">
          Mobile apps talk to backends that are often unfinished, rate-limited, or flaky. Mocking HTTP
          lets you:
        </p>
        <ul className="space-y-2 text-muted-foreground list-disc list-inside mb-4">
          <li>Develop offline or on a plane without waiting on staging</li>
          <li>Demo a stable product state to stakeholders</li>
          <li>Keep Detox / Maestro / Appium E2E runs deterministic</li>
          <li>Build UI against contracts before a backend team ships an endpoint</li>
        </ul>
        <p className="text-muted-foreground">
          The hard part on React Native is that browser Service Workers do not exist. Whatever you
          choose has to intercept at the HTTP client layer (fetch / axios) or sit on the network as a
          React Native mock server.
        </p>
      </section>

      <section id="options">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          Options: stubs, MSW, React Native mock server, or record-replay
        </h2>
        <p className="text-muted-foreground mb-6">
          These approaches can coexist. Many teams use MSW for a single API with hand-written
          handlers, and record-and-replay when several backend systems and teams are involved.
        </p>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hand-written stubs / Jest mocks</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Best for:</strong> unit tests of a single module where you control the
                dependency boundary.
              </p>
              <p>
                <strong>Trade-off:</strong> you invent response shapes. They drift when APIs rename
                fields. Poor fit for full-app or E2E flows.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">MSW (msw/native)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Best for:</strong> a small surface area where you want typed, in-code handlers
                and full control over response logic.
              </p>
              <p>
                <strong>Trade-off:</strong> every endpoint needs a handler you maintain. As the number
                of upstream systems grows, handler drift becomes the tax. See also{' '}
                <Link to="/guides/react-native-without-msw" className="text-primary hover:underline">
                  Handlers vs Recording
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Local React Native mock server</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Best for:</strong> pointing the app at{' '}
                <code className="bg-muted px-1 rounded text-xs">http://10.0.2.2:…</code> (Android
                emulator) or a LAN IP and serving canned JSON.
              </p>
              <p>
                <strong>Trade-off:</strong> you still hand-author payloads, and physical devices need
                network reachability. No automatic capture of real production shapes.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg">Record-and-replay (Mockifyer)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Best for:</strong> larger apps that call many underlying systems across teams —
                record real traffic once, store JSON under{' '}
                <code className="bg-muted px-1 rounded text-xs">mock-data/</code>, replay offline,
                switch scenarios, freeze dates, optionally share via{' '}
                <a href="#global-storage" className="text-primary hover:underline">
                  global storage
                </a>
                .
              </p>
              <p>
                <strong>Trade-off:</strong> you need a short recording pass and Metro (or dashboard
                proxy) wiring. Not a replacement for MSW when you want purely synthetic handler
                logic.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="mock-fetch-react-native">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          How to mock fetch in React Native / Expo
        </h2>

        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md mb-6">
          <p className="text-sm text-muted-foreground">
            <strong>
              Already ran <code className="bg-muted px-1 rounded">npx mockifyer init</code>?
            </strong>{' '}
            Skip to{' '}
            <a href="#record" className="text-primary hover:underline">
              Selective recording
            </a>{' '}
            if setup and Metro are already in place. Full install path:{' '}
            <Link to="/getting-started" className="text-primary hover:underline">
              Getting Started
            </Link>
            .
          </p>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-3">1. Install for Expo API mocking</h3>
            <p className="text-muted-foreground mb-3">
              React Native / Expo apps use{' '}
              <code className="bg-muted px-1 rounded text-xs">@sgedda/mockifyer-fetch</code>, which
              patches <code className="bg-muted px-1 rounded text-xs">global.fetch</code>. Hybrid
              storage also needs Expo FileSystem:
            </p>
            <CodeBlock
              language="bash"
              code={`npm install --save-dev @sgedda/mockifyer-core @sgedda/mockifyer-fetch
npx expo install expo-file-system`}
            />
            <p className="text-sm text-muted-foreground mt-3">
              Optional:{' '}
              <code className="bg-muted px-1 rounded text-xs">
                npx -p @sgedda/mockifyer-core mockifyer init
              </code>{' '}
              writes a selective-recording config and prints RN setup when it detects{' '}
              <code className="bg-muted px-1 rounded text-xs">react-native</code> in your dependencies.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">2. Configure Metro</h3>
            <p className="text-muted-foreground mb-3">
              Stub Node built-ins and enable Hybrid sync so device recordings land in your project{' '}
              <code className="bg-muted px-1 rounded text-xs">mock-data/</code> folder:
            </p>
            <CodeBlock
              language="javascript"
              code={`// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

const config = getDefaultConfig(__dirname);
module.exports = configureMetroForMockifyer(config, {
  syncMiddleware: {
    projectRoot: __dirname,
    mockDataPath: './mock-data',
    // atlasKey: 't' — optional Metro terminal Atlas capture
    // dashboardKey: 'd' — optional; opens the dashboard in the browser
    // dashboardUrl: process.env.MOCKIFYER_DASHBOARD_URL || 'http://localhost:3002',
  },
});`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">3. Init — intercept fetch</h3>
            <CodeBlock
              language="typescript"
              code={`// mockifyer-setup.ts
import {
  setupMockifyerForReactNative,
  isMockifyerReactNativeActive,
} from '@sgedda/mockifyer-fetch';

export async function initializeMockifyer() {
  const result = await setupMockifyerForReactNative({
    isDev: __DEV__,
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode: __DEV__ && process.env.EXPO_PUBLIC_MOCKIFYER_RECORD === 'true',
    // MOCKIFYER_MODE / runtimeMode: 'on' | 'manual' | 'launch_client' | 'off'
  });

  if (isMockifyerReactNativeActive(result)) {
    // result.instance.enableMockifyer() / disableMockifyer() when runtimeMode is 'manual'
  }
  return result;
}`}
            />
            <p className="text-sm text-muted-foreground mt-3">
              Import and <code className="bg-muted px-1 rounded text-xs">await initializeMockifyer()</code>{' '}
              early in your root layout so the first network call is intercepted. Default{' '}
              <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_MODE</code> when unset is{' '}
              <code className="bg-muted px-1 rounded text-xs">on</code>. See the{' '}
              <Link to="/config-reference" className="text-primary hover:underline">
                configuration reference
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section id="mock-axios-react-native">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          How to mock axios in React Native
        </h2>
        <p className="text-muted-foreground mb-3">
          If your app uses axios, set up{' '}
          <code className="bg-muted px-1 rounded text-xs">@sgedda/mockifyer-axios</code> with{' '}
          <code className="bg-muted px-1 rounded text-xs">useGlobalAxios: true</code> (call before
          importing axios). Axios uses a filesystem or dashboard-proxy path — not the Expo Hybrid
          provider that <code className="bg-muted px-1 rounded text-xs">setupMockifyerForReactNative</code>{' '}
          configures for fetch:
        </p>
        <CodeBlock
          language="typescript"
          code={`import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: __DEV__ && process.env.EXPO_PUBLIC_MOCKIFYER_RECORD === 'true',
  useGlobalAxios: true,
  // Optional E2E lane: useLaunchArgumentsClientId: true
});

import axios from 'axios';`}
        />
      </section>

      <section id="record">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Selective recording</h2>
        <p className="text-muted-foreground mb-4">
          Preferred workflow: record request metadata into the ephemeral{' '}
          <code className="bg-muted px-1 rounded text-xs">_scratch</code> scenario. Calls stay on the
          live API until you activate a mock in the dashboard (clear{' '}
          <code className="bg-muted px-1 rounded text-xs">alwaysUseRealApi</code> / “Always use live API”)
          or enable paths via domain-path rules (
          <code className="bg-muted px-1 rounded text-xs">recordResponses</code> /{' '}
          <code className="bg-muted px-1 rounded text-xs">autoMock</code>).
        </p>
        <CodeBlock
          language="bash"
          code="EXPO_PUBLIC_MOCKIFYER_RECORD=true npx expo start"
        />
        <p className="text-muted-foreground mt-4 mb-4">
          Domain-path rules default to allowlist mode (
          <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_DOMAIN_PATH_RULES_MODE=allowlist</code>
          ): traffic discovers host/path keys with recording off until you opt in.
        </p>

        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Capture-all (heavy “try it quickly” option)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              For a short demo only — store full bodies and enable record/replay on discovered paths:
            </p>
            <CodeBlock
              language="bash"
              code="EXPO_PUBLIC_MOCKIFYER_RECORD=true EXPO_PUBLIC_MOCKIFYER_RECORD_RESPONSES=true MOCKIFYER_DOMAIN_PATH_RULES_MODE=record_all npx expo start"
            />
            <p className="text-sm text-muted-foreground">
              Or nest the mode on setup config:{' '}
              <code className="bg-muted px-1 rounded text-xs">
                config: {'{'} domainPathRulesMode: &apos;record_all&apos; {'}'}
              </code>
              . Prefer selective activation for day-to-day work.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="replay-mix">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Replay and mix mocked vs live</h2>
        <p className="text-muted-foreground mb-4">
          Start without <code className="bg-muted px-1 rounded text-xs">EXPO_PUBLIC_MOCKIFYER_RECORD=true</code>{' '}
          to replay activated mocks. Endpoints you never activated (or that keep{' '}
          <code className="bg-muted px-1 rounded text-xs">alwaysUseRealApi</code>) continue to hit the
          real API — that is how you mix mocked and live traffic in one session.
        </p>
        <CodeBlock language="bash" code="npx expo start" />
      </section>

      <section id="global-storage">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          Global storage / shared mocks (Redis or SQLite)
        </h2>
        <p className="text-muted-foreground mb-4">
          Hybrid + Metro keeps mocks on <em>your</em> machine. When a teammate&apos;s device, CI job,
          demo build, or phone cannot reach your local <code className="bg-muted px-1 rounded text-xs">mock-data/</code>{' '}
          folder or filesystem dashboard, run the dashboard against a{' '}
          <strong>shared store</strong> and proxy app traffic through it. Everyone then loads the same
          recordings and scenarios.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Dashboard docs:{' '}
          <Link to="/dashboard" className="text-primary hover:underline">
            Dashboard and MCP
          </Link>
          {' · '}
          <a
            href="https://github.com/sgedda/mockifyer/blob/main/packages/mockifyer-dashboard/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            @sgedda/mockifyer-dashboard README
          </a>
          {' · '}
          <a
            href="https://github.com/sgedda/mockifyer/blob/main/MULTI_CLIENT_ISOLATION.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Client lanes design note
          </a>
          .
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Enable the shared store
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The HTTP proxy at <code className="bg-muted px-1 rounded text-xs">/api/proxy</code> requires{' '}
              <code className="bg-muted px-1 rounded text-xs">redis</code> or{' '}
              <code className="bg-muted px-1 rounded text-xs">sqlite</code> — not the default filesystem
              provider. Redis is the usual choice for multi-device lanes.
            </p>
            <CodeBlock
              language="bash"
              code={`# Redis as source of truth for mocks + scenarios (default key prefix mockifyer:v1)
npx @sgedda/mockifyer-dashboard --provider redis \\
  --redis-url redis://127.0.0.1:6379 \\
  --path ./mock-data \\
  --host 0.0.0.0

# Optional: also write recorded mocks to disk for git
#   --redis-mirror-disk   (env: MOCKIFYER_REDIS_MIRROR_DISK=true)
# Optional: if Redis misses, try JSON under mock-data/<scenario>/ before upstream
#   --redis-disk-fallback (env: MOCKIFYER_REDIS_DISK_READ_FALLBACK=true)
# Shorthand for both: --redis-disk-dual`}
            />
            <ul className="list-disc list-inside space-y-2">
              <li>
                <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_REDIS_URL</code> /{' '}
                <code className="bg-muted px-1 rounded text-xs">--redis-url</code> — connection string
              </li>
              <li>
                <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_REDIS_KEY_PREFIX</code> /{' '}
                <code className="bg-muted px-1 rounded text-xs">--key-prefix</code> — default{' '}
                <code className="bg-muted px-1 rounded text-xs">mockifyer:v1</code> (multi-tenant lever)
              </li>
              <li>
                <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_DB_PROVIDER</code> —{' '}
                <code className="bg-muted px-1 rounded text-xs">redis</code> |{' '}
                <code className="bg-muted px-1 rounded text-xs">sqlite</code> |{' '}
                <code className="bg-muted px-1 rounded text-xs">filesystem</code>
              </li>
              <li>
                Bind with <code className="bg-muted px-1 rounded text-xs">--host 0.0.0.0</code> so other
                machines on the LAN can reach the dashboard
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4 mb-6">
          <h3 className="text-xl font-semibold">Point the React Native app at it</h3>
          <p className="text-muted-foreground text-sm">
            Use the RN dashboard preset. URL resolution order:{' '}
            <code className="bg-muted px-1 rounded text-xs">proxyBaseUrl</code> →{' '}
            <code className="bg-muted px-1 rounded text-xs">dashboardBaseUrl</code> →{' '}
            <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_PROXY_URL</code> (Expo often uses{' '}
            <code className="bg-muted px-1 rounded text-xs">EXPO_PUBLIC_MOCKIFYER_PROXY_URL</code>).
          </p>
          <CodeBlock
            language="typescript"
            code={`import { initMockifyerForReactNativeDashboard } from '@sgedda/mockifyer-fetch';
import { Platform } from 'react-native';

const dashboardBaseUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3002' // emulator → host
    : 'http://192.168.1.20:3002'; // physical device / teammate: host LAN IP

await initMockifyerForReactNativeDashboard({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  dashboardBaseUrl,
  recordMode: __DEV__ && process.env.EXPO_PUBLIC_MOCKIFYER_RECORD === 'true',
  // Optional: clientId / MOCKIFYER_CLIENT_ID for a client lane
});`}
          />
          <p className="text-sm text-muted-foreground">
            Traffic goes through dashboard <code className="bg-muted px-1 rounded text-xs">POST /api/proxy</code>.
            Scenarios resolve from proxy body override → client lane (
            <code className="bg-muted px-1 rounded text-xs">client_scenario:{'{'}clientId{'}'}</code>) →
            global active scenario. Set a lane with{' '}
            <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_CLIENT_ID</code> or launch arg{' '}
            <code className="bg-muted px-1 rounded text-xs">mockifyerClientId</code> so one device can run{' '}
            <code className="bg-muted px-1 rounded text-xs">trips-empty</code> while another runs{' '}
            <code className="bg-muted px-1 rounded text-xs">trips-many</code>.
          </p>
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg">Limits and honesty notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-2">
              <li>
                Redis write caps: default max{' '}
                <strong>200</strong> distinct mocks per METHOD+host+path (
                <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_MAX_MOCKS_PER_PATH</code>; set{' '}
                <code className="bg-muted px-1 rounded text-xs">0</code> to disable). Optional scenario cap:{' '}
                <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_MAX_REQUESTS_PER_SCENARIO</code>.
              </li>
              <li>
                Filesystem Hybrid remains best for solo laptop + simulator work; switch to Redis/SQLite
                proxy when you need a shared source of truth.
              </li>
              <li>
                Hosted multi-tenant “cloud Mockifyer” as a SaaS product is not what this section
                describes — this is <em>your</em> Redis/SQLite + dashboard process that devices can reach.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section id="freeze-date">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Freeze the date</h2>
        <p className="text-muted-foreground mb-4">
          Time-dependent UI (“check-in opens today”) needs a stable clock. Use{' '}
          <code className="bg-muted px-1 rounded text-xs">getCurrentDate()</code> from the same package
          as setup (re-exported from <code className="bg-muted px-1 rounded text-xs">@sgedda/mockifyer-fetch</code>),
          not <code className="bg-muted px-1 rounded text-xs">new Date()</code>. Fix time via{' '}
          <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_DATE</code>,{' '}
          <code className="bg-muted px-1 rounded text-xs">dateManipulation.fixedDate</code>, or the
          dashboard Date Config for the active scenario.
        </p>
        <CodeBlock
          language="typescript"
          code={`import { getCurrentDate } from '@sgedda/mockifyer-fetch';

const today = getCurrentDate(); // respects MOCKIFYER_DATE / scenario Date Config`}
        />
        <p className="text-sm text-muted-foreground mt-3">
          More detail:{' '}
          <Link to="/date-config" className="text-primary hover:underline">
            Date Configuration
          </Link>
          .
        </p>
      </section>

      <section id="dashboard">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          Switch scenarios from the dashboard
        </h2>
        <p className="text-muted-foreground mb-4">
          The dashboard usually runs on your laptop, not on the phone. Filesystem mode for local
          editing:
        </p>
        <CodeBlock
          language="bash"
          code={`npm install --save-dev @sgedda/mockifyer-dashboard
npx mockifyer-dashboard --path ./mock-data
# UI at http://localhost:3002`}
        />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5" />
              How the app reaches the host
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>iOS Simulator:</strong>{' '}
                <code className="bg-muted px-1 rounded text-xs">http://localhost:3002</code>
              </li>
              <li>
                <strong>Android emulator:</strong>{' '}
                <code className="bg-muted px-1 rounded text-xs">http://10.0.2.2:3002</code> (special
                alias to the host loopback)
              </li>
              <li>
                <strong>Physical device / teammate:</strong> your machine&apos;s LAN IP, e.g.{' '}
                <code className="bg-muted px-1 rounded text-xs">http://192.168.1.20:3002</code>
              </li>
            </ul>
            <p>
              For shared Redis/SQLite proxy mode, prefer{' '}
              <a href="#global-storage" className="text-primary hover:underline">
                global storage
              </a>{' '}
              above. The dashboard rewrites emulator loopback hosts (
              <code className="bg-muted px-1 rounded text-xs">10.0.2.2</code>) to{' '}
              <code className="bg-muted px-1 rounded text-xs">127.0.0.1</code> before upstream calls.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="drift-atlas">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Drift detection and Atlas</h2>
        <p className="text-muted-foreground mb-4">
          Once mocks live in git (or Redis + disk mirror), two extras help larger teams:
        </p>
        <ul className="space-y-3 text-muted-foreground list-disc list-inside">
          <li>
            <Link to="/guides/mock-drift" className="text-primary hover:underline">
              Mock drift
            </Link>{' '}
            — compare recorded mocks to live staging so API renames show up in CI instead of
            production.
          </li>
          <li>
            <Link to="/guides/mockifyer-atlas" className="text-primary hover:underline">
              Mockifyer Atlas
            </Link>{' '}
            — interactive maps of recorded hops. In Metro Hybrid setups, press{' '}
            <code className="bg-muted px-1 rounded text-xs">t</code> to start/stop live Atlas capture
            (opens <code className="bg-muted px-1 rounded text-xs">/mockifyer-atlas-live</code>).
          </li>
        </ul>
      </section>

      <section id="e2e">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Using it in E2E tests</h2>
        <p className="text-muted-foreground mb-4">
          Lock a scenario (and optional client lane) with native launch arguments so every Detox or
          Maestro run boots into the same recorded world. Prefer{' '}
          <code className="bg-muted px-1 rounded text-xs">MOCKIFYER_MODE=launch_client</code> so mocks
          activate only when those args are present.
        </p>
        <CodeBlock
          language="yaml"
          code={`# Maestro
appId: com.example.app
---
- launchApp:
    arguments:
      scenario: trips-empty
      mockifyerClientId: maestro-test

- assertVisible: "No trips yet"`}
        />
        <p className="text-sm text-muted-foreground mt-4">
          Full walkthrough:{' '}
          <Link to="/guides/stable-react-native-e2e" className="text-primary hover:underline">
            Stable React Native E2E
          </Link>
          . Multi-service demo:{' '}
          <Link to="/e2e-tutorial" className="text-primary hover:underline">
            E2E Tutorial
          </Link>
          .
        </p>
      </section>

      <section id="faq">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">FAQ</h2>
        <div className="space-y-6">
          {RN_GUIDE_FAQ.map((item) => (
            <div key={item.question}>
              <h3 className="text-lg font-semibold mb-2">{item.question}</h3>
              <p className="text-muted-foreground text-sm">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="next-steps">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Next steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link to="/">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Home</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Product overview and feature highlights
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/getting-started">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Getting Started</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Install, selective recording into _scratch, activate, replay
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/guides/stable-react-native-e2e">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Stable React Native E2E</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Detox / Maestro launch args, scenarios, frozen dates
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/e2e-tutorial">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">E2E Tutorial</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  WanderWeird multi-service walkthrough with Playwright
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/guides/react-native-without-msw">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Handlers vs Recording</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Deeper MSW vs Mockifyer comparison for React Native
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/guides/mock-drift">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Stop Mock Drift
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Keep recorded mocks honest against staging APIs
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/guides/mockifyer-atlas">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Mockifyer Atlas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Visualize multi-service request chains from recorded hops
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/dashboard">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Scenarios, client lanes, Redis &amp; disk mirror
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/config-reference">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Config Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Env vars: MOCKIFYER_MODE, RECORD, DOMAIN_PATH_RULES_MODE, and more
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-6">
          Example apps:{' '}
          <a
            href="https://github.com/sgedda/mockifyer/tree/main/example-projects/react-native-expo-example"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            react-native-expo-example
          </a>
          {' · '}
          <a
            href="https://github.com/sgedda/mockifyer/tree/main/example-projects/wanderweird-travel"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            wanderweird-travel
          </a>
        </p>
      </section>
    </div>
  )
}
