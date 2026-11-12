import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function MaestroDetoxMocks() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Mock APIs in Maestro and Detox E2E</h1>
        <p className="text-xl text-muted-foreground">Lock a React Native E2E run to a recorded Mockifyer scenario with a launch argument from Maestro or Detox. Mocks are served inside the app or by the Mockifyer dashboard, with no WireMock server.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">If you want to know <em>why</em> React Native E2E runs flake against a live backend, read <Link to="/guides/stable-react-native-e2e" className="text-primary hover:underline">Stable React Native E2E Tests</Link>. This page is the how-to: launch the app with a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> argument, and every API call in that run is answered from that recorded scenario.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="how-it-works">How it works</h2>
        <p className="mb-4 text-muted-foreground"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">setupMockifyerForReactNative</code> reads launch arguments through the optional peer <code className="text-sm bg-muted px-1.5 py-0.5 rounded">react-native-launch-arguments</code>. It looks at two keys:</p>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Launch argument</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Effect</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code></td>
              <td className="border border-border px-4 py-2">Highest-priority scenario for the run, above <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_SCENARIO</code>, config defaults, Metro's scenario and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario-config.json</code>. It also activates Mockifyer (even with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">runtimeMode: 'launch_client'</code>), starts it <strong>enabled</strong> (even with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">runtimeMode: 'manual'</code>), and is sent as the scenario on every dashboard-proxy request.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockifyerClientId</code></td>
              <td className="border border-border px-4 py-2">A client lane id. The dashboard maps that lane to a scenario, which you can change while the app is running.</td>
            </tr>
          </table>
        </div>
        <p className="mb-4 text-muted-foreground"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">runtimeMode: 'off'</code> (or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_MODE=off</code>) still wins. Launch arguments can't turn Mockifyer on in a build where it's off.</p>
        <p className="mb-4 text-muted-foreground">Scenario detection from launch arguments is on by default. Opt out with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">useLaunchArgumentsScenario: false</code>. If you read the argument yourself, call <code className="text-sm bg-muted px-1.5 py-0.5 rounded">setScenarioLaunchOverride(name, &#123; fromLaunchArguments: true &#125;)</code> from <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-core</code> before setup.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="app-setup">App setup</h2>
        <CodeBlock language="bash" code={`npm install react-native-launch-arguments`} />
        <CodeBlock language="ts" code={`import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';

await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  bundledDataPath: './assets/mock-data',
  recordMode: false,           // E2E replays; record on your machine, not in the test run
  runtimeMode: 'launch_client' // only patch fetch when a scenario or mockifyerClientId launch arg is present
});`} />
        <p className="mb-4 text-muted-foreground">With <code className="text-sm bg-muted px-1.5 py-0.5 rounded">launch_client</code>, a normal dev launch with no arguments leaves <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> untouched.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="maestro">Maestro</h2>
        <CodeBlock language="yaml" code={`# flows/trips-empty.yaml
appId: com.example.app
---
- launchApp:
    clearState: true
    arguments:
      scenario: trips-empty
- assertVisible: "No trips yet"`} />
        <p className="mb-4 text-muted-foreground">The repo's <a href="https://github.com/sgedda/mockifyer/tree/main/example-projects/maestro-login-flow" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><code className="text-sm bg-muted px-1.5 py-0.5 rounded">example-projects/maestro-login-flow</code></a> uses the lane variant instead (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockifyerClientId: e2e-maestro-login</code>), with the scenario picked in the dashboard for that lane.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="detox">Detox</h2>
        <p className="mb-4 text-muted-foreground">Detox passes launch arguments through <code className="text-sm bg-muted px-1.5 py-0.5 rounded">device.launchApp</code>:</p>
        <CodeBlock language="js" code={`// e2e/trips.test.js
describe('trip list', () => {
  beforeEach(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { scenario: 'trips-empty' },
    });
  });

  it('shows the empty state', async () => {
    await expect(element(by.text('No trips yet'))).toBeVisible();
  });
});`} />
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-the-mocks-are-served-from">Where the mocks are served from</h2>
        <p className="mb-4 text-muted-foreground">This part depends on your setup. Pick one deliberately.</p>
        <p className="mb-4 text-muted-foreground"><strong>Dashboard proxy (the setup this repo's Android CI workflow uses).</strong> Run <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockifyer-dashboard --provider sqlite</code> (or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">redis</code>) and point the app at it with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">proxyBaseUrl</code> / <code className="text-sm bg-muted px-1.5 py-0.5 rounded">initMockifyerForReactNativeDashboard</code>. The launch <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> goes along with every proxied request, so the dashboard answers from that scenario without any lane mapping. You do run one extra process here, but it's the same Mockifyer dashboard you use day to day, not a separate JVM mock server.</p>
        <CodeBlock language="bash" code={`npx mockifyer-dashboard --provider sqlite --path ./mock-data --port 3002 --host 127.0.0.1`} />
        <p className="mb-4 text-muted-foreground">On an Android emulator, the app reaches the host at <code className="text-sm bg-muted px-1.5 py-0.5 rounded">http://10.0.2.2:3002</code>. The dashboard rewrites emulator loopback hosts to <code className="text-sm bg-muted px-1.5 py-0.5 rounded">127.0.0.1</code> before matching and calling upstream.</p>
        <p className="mb-4 text-muted-foreground"><strong>Hybrid (Metro, dev builds).</strong> Mocks live on the device and in your repo, and are served inside the app, so no mock server runs at all. One caveat: when the app starts, the device pulls mock files for <strong>Metro's</strong> current scenario (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">MOCKIFYER_SCENARIO</code> or <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario-config.json</code> on the Metro side). Keep Metro's scenario in line with the scenario your flow launches, or use the proxy setup for multi-scenario suites.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="make-the-scenarios-e2e-ready">Make the scenarios E2E-ready</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>Record each state once into its own named scenario (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">trips-empty</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">trips-with-data</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">trips-error</code>). See <Link to="/guides/scenarios" className="text-primary hover:underline">Switch Mock Scenarios</Link>.</li>
          <li>Make sure every endpoint the flow touches can replay in that scenario: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">autoMock: true</code> in that scenario's <code className="text-sm bg-muted px-1.5 py-0.5 rounded">domain-path-rules.json</code> (the dashboard's <strong>Record response</strong> sets it), and the mocks themselves on <strong>Replay</strong> with a captured body. Under the default <code className="text-sm bg-muted px-1.5 py-0.5 rounded">allowlist</code> mode, a path with no rule goes to the live API.</li>
          <li>For error and slow-network states, set <code className="text-sm bg-muted px-1.5 py-0.5 rounded">statusOverride</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">responseDelayMs</code> on a mock instead of recording a real failure.</li>
          <li>For screens that depend on the current date, read time through <code className="text-sm bg-muted px-1.5 py-0.5 rounded">getCurrentDate()</code> from <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@sgedda/mockifyer-core</code>, and set <code className="text-sm bg-muted px-1.5 py-0.5 rounded">dateManipulation</code> (inside <code className="text-sm bg-muted px-1.5 py-0.5 rounded">config</code>) or the dashboard's Date Config. There's no date launch argument. Only <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">mockifyerClientId</code> are read.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/e2e-tutorial" className="text-primary hover:underline">E2E tutorial</Link></li>
          <li><Link to="/guides/stable-react-native-e2e" className="text-primary hover:underline">Why React Native E2E flakes</Link></li>
          <li><Link to="/guides/react-native-expo" className="text-primary hover:underline">React Native and Expo</Link></li>
          <li><Link to="/guides/scenarios" className="text-primary hover:underline">Switch Mock Scenarios for Test Data</Link></li>
          <li><Link to="/comparisons/wiremock" className="text-primary hover:underline">Mockifyer vs WireMock</Link></li>
        </ul>
      </div>
    </div>
  )
}
