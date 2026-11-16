import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function ReactNativeExpo() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">React Native and Expo API mocking with Mockifyer</h1>
        <p className="text-xl text-muted-foreground">Record real fetch calls in Expo and React Native with Mockifyer, then replay them in dev and E2E without hand-written handlers.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">Mockifyer patches <code className="text-sm bg-muted px-1.5 py-0.5 rounded">global.fetch</code> inside your React Native or Expo app. It records the requests your app really makes, writes them as JSON into your project's <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mock-data/</code> folder (through Metro), and replays them later in dev and in E2E runs. You never write a handler. You pick which recorded calls should be served as mocks.</p>
        <p className="mb-4 text-muted-foreground">This guide covers the Expo/React Native setup. For the recording model itself (why nothing is mocked until you choose), read <Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link> first.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="what-you-need">What you need</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-fetch</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-core</code> (see <Link to="/packages" className="text-primary hover:underline">Packages</Link>)</li>
          <li><code className="text-sm bg-muted px-1.5 py-0.5 rounded">expo-file-system</code> (the device side of the Hybrid store)</li>
          <li>Optional: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">react-native-launch-arguments</code>, if E2E tools should pick the scenario (<Link to="/guides/maestro-detox-mocks" className="text-primary hover:underline">Maestro and Detox guide</Link>)</li>
          <li>Optional: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-dashboard</code>, the local UI where you choose what to mock</li>
        </ul>
        <CodeBlock language="bash" code={`npm install @sgedda/mockifyer-fetch @sgedda/mockifyer-core
npx expo install expo-file-system`} />
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="1-metro-config">1. Metro config</h2>
        <p className="mb-4 text-muted-foreground">In dev, Mockifyer uses a <strong>Hybrid</strong> store. Mocks are saved on the device and also sent to Metro, which writes them into your repo's <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mock-data/</code> folder. Metro needs the sync middleware for that, and it needs Node built-ins like <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fs</code> stubbed out:</p>
        <CodeBlock language="js" code={`// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = configureMetroForMockifyer(config, {
  syncMiddleware: {
    projectRoot: __dirname,
    mockDataPath: './mock-data',
  },
});`} />
        <p className="mb-4 text-muted-foreground">If Metro runs on a port other than 8081, set <code className="text-sm bg-muted px-1.5 py-0.5 rounded">METRO_PORT</code> so the app can reach the save and sync endpoints.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="2-initialize-before-your-app-makes-requests">2. Initialize before your app makes requests</h2>
        <p className="mb-4 text-muted-foreground"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">setupMockifyerForReactNative</code> is async. Await it before anything fetches. <code className="text-sm bg-muted px-1.5 py-0.5 rounded">isDev</code> is required: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">true</code> selects the Hybrid store (it can record), and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">false</code> selects an in-memory store loaded from a bundled mock module.</p>
        <CodeBlock language="ts" code={`// mockifyer-setup.ts
import {
  setupMockifyerForReactNative,
  isMockifyerReactNativeActive,
} from '@sgedda/mockifyer-fetch/react-native';

export async function initializeMockifyer() {
  const result = await setupMockifyerForReactNative({
    isDev: __DEV__,
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    // Your app decides when to record. EXPO_PUBLIC_ vars are inlined at bundle time.
    recordMode: __DEV__ && process.env.EXPO_PUBLIC_MOCKIFYER_RECORD === 'true',
    // Other MockifyerConfig options (dateManipulation, domainPathRulesMode, ...) go here:
    config: {},
  });

  if (isMockifyerReactNativeActive(result)) {
    // result.instance.enableMockifyer() / disableMockifyer() / isMockifyerEnabled()
  }
  return result;
}`} />
        <p className="mb-4 text-muted-foreground">The function resolves to <code className="text-sm bg-muted px-1.5 py-0.5 rounded">&#123; status, instance &#125;</code>, where <code className="text-sm bg-muted px-1.5 py-0.5 rounded">status</code> is <code className="text-sm bg-muted px-1.5 py-0.5 rounded">'active'</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">'not_activated'</code> or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">'failed_no_bundled_mocks'</code>. Options that belong to the general Mockifyer config, like <code className="text-sm bg-muted px-1.5 py-0.5 rounded">dateManipulation</code> or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">domainPathRulesMode</code>, go inside <code className="text-sm bg-muted px-1.5 py-0.5 rounded">config</code>, not at the top level.</p>
        <h3 className="text-xl font-semibold mb-3 mt-6" id="when-mockifyer-is-allowed-to-run">When Mockifyer is allowed to run</h3>
        <p className="mb-4 text-muted-foreground">The <code className="text-sm bg-muted px-1.5 py-0.5 rounded">runtimeMode</code> option (or the <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_MODE</code> env var) decides whether <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> gets patched at all:</p>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Value</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Behaviour</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">on</code> (default when unset)</td>
              <td className="border border-border px-4 py-2">Patch at startup, start enabled</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">manual</code></td>
              <td className="border border-border px-4 py-2">Patch at startup, start disabled. Turn it on with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">instance.enableMockifyer()</code> (for example from a dev menu). Add <code className="text-sm bg-muted px-1.5 py-0.5 rounded">persistRuntimeEnabled: true</code> to remember the choice across restarts (needs AsyncStorage).</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">launch_client</code></td>
              <td className="border border-border px-4 py-2">Patch only when the app was launched with a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockifyerClientId</code> launch argument. This is meant for E2E.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">off</code></td>
              <td className="border border-border px-4 py-2">Never patch, and launch arguments can't override it. Use this for store builds.</td>
            </tr>
          </table>
        </div>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="3-record-then-choose-what-to-mock">3. Record, then choose what to mock</h2>
        <p className="mb-4 text-muted-foreground">Start Metro with your record flag:</p>
        <CodeBlock language="bash" code={`EXPO_PUBLIC_MOCKIFYER_RECORD=true npx expo start`} />
        <p className="mb-4 text-muted-foreground">Use the app as usual. By default, each new request is saved as a <strong>request-only stub</strong>: the URL, method and headers, with no response body. Your app keeps talking to the live API. If you haven't selected a scenario, the stubs go into the temporary <code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code> scenario. Mockifyer also writes a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">domain-path-rules.json</code> for that scenario listing the hosts and paths it has seen.</p>
        <p className="mb-4 text-muted-foreground">Then open the dashboard against the same folder:</p>
        <CodeBlock language="bash" code={`npx mockifyer-dashboard --path ./mock-data`} />
        <p className="mb-4 text-muted-foreground">In the dashboard's domain tree, do two things for each path you want mocked:</p>
        <p className="mb-4 text-muted-foreground">1. <strong>Record response.</strong> This turns the path's rule on (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">recordResponses</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">autoMock</code>). Under the default <code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code> mode, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">autoMock</code> is what allows a path to replay at all.</p>
        <p className="mb-4 text-muted-foreground">2. <strong>Replay</strong> (instead of <strong>Live</strong>) on the folder. Each stub in it gets marked "refresh on next request": the next matching call fetches the real response, saves it into the file, and later calls replay it.</p>
        <p className="mb-4 text-muted-foreground">That's the whole loop: browse, then choose a handful of endpoints, then those endpoints become stable. Everything else stays live. The <Link to="/guides/selective-recording" className="text-primary hover:underline">selective recording guide</Link> explains the rules file and the three switches involved.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="4-replay-and-scenarios">4. Replay and scenarios</h2>
        <p className="mb-4 text-muted-foreground">Without the record flag, the app replays whatever you've activated in the current scenario. To keep mocks long term, record into a named scenario rather than <code className="text-sm bg-muted px-1.5 py-0.5 rounded">_scratch</code>, for example <code className="text-sm bg-muted px-1.5 py-0.5 rounded">trips-empty</code> or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">trips-error</code>. You can switch scenarios from the dashboard, through <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_SCENARIO</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario-config.json</code> on the Metro side, or per E2E run through a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> launch argument. The <Link to="/guides/scenarios" className="text-primary hover:underline">scenarios guide</Link> covers all of these.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="physical-devices-and-shared-setups-dashboard-proxy">Physical devices and shared setups: dashboard proxy</h2>
        <p className="mb-4 text-muted-foreground">The Hybrid store relies on Metro on <code className="text-sm bg-muted px-1.5 py-0.5 rounded">localhost</code>. You can instead route traffic through the dashboard. Start it with a central store (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">--provider sqlite</code> or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">--provider redis</code>) and use the preset:</p>
        <CodeBlock language="ts" code={`import { initMockifyerForReactNativeDashboard } from '@sgedda/mockifyer-fetch/react-native';

await initMockifyerForReactNativeDashboard({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  dashboardBaseUrl: 'http://10.0.2.2:3002', // Android emulator → host; iOS simulator: http://localhost:3002
  recordMode: __DEV__ && process.env.EXPO_PUBLIC_MOCKIFYER_RECORD === 'true',
});`} />
        <p className="mb-4 text-muted-foreground">Before wiring the proxy, the preset checks that the dashboard reports a healthy store at <code className="text-sm bg-muted px-1.5 py-0.5 rounded">GET /api/health</code>. Proxy recordings are request-only by default too (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">proxyRecordResponses</code> defaults to <code className="text-sm bg-muted px-1.5 py-0.5 rounded">false</code>). On a physical device, use your machine's LAN IP instead of <code className="text-sm bg-muted px-1.5 py-0.5 rounded">localhost</code>.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="want-to-see-everything-captured-once-">Want to see everything captured once?</h2>
        <p className="mb-4 text-muted-foreground">Capturing every response body is possible, but it's heavy: every request is written in full and replayed straight away. I'd only use it for a short try-out. The quickest place to see it is the Node demo <a href="https://github.com/sgedda/mockifyer/tree/main/demos/record-replay-basics" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">demos/record-replay-basics</code></a> (it runs in StackBlitz). In an app, use the dashboard's per-folder Replay instead, so you only store what you actually want to replay.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="what-about-axios-">What about axios?</h2>
        <p className="mb-4 text-muted-foreground">The RN helper patches <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code>. Axios in React Native normally sends requests through <code className="text-sm bg-muted px-1.5 py-0.5 rounded">XMLHttpRequest</code>, so a fetch patch doesn't see them. <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-axios</code> has its own <code className="text-sm bg-muted px-1.5 py-0.5 rounded">setupMockifyer</code> with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">useGlobalAxios: true</code>, and the RN docs show it for launch-argument lanes. There's no React Native example project using axios in the repo yet, though, so treat axios on RN as something to verify in your own app.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="production-builds">Production builds</h2>
        <p className="mb-4 text-muted-foreground">Set <code className="text-sm bg-muted px-1.5 py-0.5 rounded">runtimeMode: 'off'</code> (or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_MODE=off</code>) in store builds. Then the code ships but never patches <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code>, whatever launch arguments you pass.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link></li>
          <li><Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording, Not Capture-All</Link></li>
          <li><Link to="/guides/maestro-detox-mocks" className="text-primary hover:underline">Mock APIs in Maestro and Detox E2E</Link></li>
          <li><Link to="/guides/scenarios" className="text-primary hover:underline">Switch Mock Scenarios for Test Data</Link></li>
          <li><Link to="/guides/stable-react-native-e2e" className="text-primary hover:underline">Why React Native E2E tests flake</Link></li>
          <li><Link to="/comparisons/msw" className="text-primary hover:underline">Mockifyer vs MSW</Link></li>
        </ul>
      </div>
    </div>
  )
}
