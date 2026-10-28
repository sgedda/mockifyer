import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Play, Terminal, CheckCircle } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function E2ETutorial() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Play className="h-8 w-8" />
          Controlling a nested multi-service stack with Mockifyer
        </h1>
        <p className="text-muted-foreground mt-2">
          An end-to-end walkthrough of the WanderWeird demo stack
        </p>
      </div>

      <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200 text-sm">
            <strong>Disclosure:</strong> Mockifyer is my own open-source project (github.com/sgedda/mockifyer).
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            What this tutorial demonstrates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This tutorial runs the Playwright e2e suite that ships with Mockifyer against the <strong>WanderWeird</strong> demo stack. 
            Each GUI test drives the real Mockifyer dashboard and shows the change land in a running app, recorded side by side 
            (app on the left, dashboard on the right).
          </p>
          
          <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-amber-900 dark:text-amber-200 text-sm">
                <strong>Branch note:</strong> The GUI tests, <code className="bg-muted px-1 rounded">E2E_PRESENTATION</code>, 
                <code className="bg-muted px-1 rounded ml-1">npm run artifacts</code>, the from-scratch test and the tracing and 
                delay tests are on PR #487 (<code className="bg-muted px-1 rounded">cursor/e2e-dashboard-gui-videos-7d37</code>). 
                Until #487 merges, check out that branch.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. What you'll build and see</CardTitle>
          <CardDescription>
            The WanderWeird stack components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-semibold">Piece</th>
                  <th className="text-left p-2 font-semibold">URL</th>
                  <th className="text-left p-2 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b">
                  <td className="p-2">WanderWeird app (Expo web via Metro)</td>
                  <td className="p-2"><code className="text-xs">http://127.0.0.1:8090</code></td>
                  <td className="p-2">The UI. The Discover tab shows the "Atlantis Boardwalk" Temperature tile.</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">gateway-api</td>
                  <td className="p-2"><code className="text-xs">http://127.0.0.1:4200</code></td>
                  <td className="p-2">BFF. <code className="text-xs">GET /api/discover</code> proxies to wander-api.</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">wander-api</td>
                  <td className="p-2"><code className="text-xs">http://127.0.0.1:4203</code></td>
                  <td className="p-2"><code className="text-xs">GET /discover</code> calls Open-Meteo, a countries API and a few other public APIs.</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Mockifyer dashboard (sqlite)</td>
                  <td className="p-2"><code className="text-xs">http://127.0.0.1:3002</code></td>
                  <td className="p-2">Holds mocks, scenarios, lanes and the network log. The services run in proxy mode through it.</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Second dashboard, branch build</td>
                  <td className="p-2"><code className="text-xs">http://127.0.0.1:3012</code></td>
                  <td className="p-2">Only for <code className="text-xs">main-features.spec.ts</code>, which covers features newer than the demo's dashboard 1.5.92.</td>
                </tr>
                <tr>
                  <td className="p-2">Scratch dashboard</td>
                  <td className="p-2"><code className="text-xs">http://127.0.0.1:3022</code></td>
                  <td className="p-2">Started and deleted by the from-scratch test only.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Call chain</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Checked against <code className="bg-muted px-1 rounded text-xs">gateway-api/src/server.ts</code> and{' '}
              <code className="bg-muted px-1 rounded text-xs">wander-api/src/server.ts</code>:
            </p>
            <div className="p-4 bg-muted rounded-md space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono">App (Expo web :8090)</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono">gateway-api :4200</span>
              </div>
              <div className="flex items-center gap-2 pl-8">
                <span className="text-xs text-muted-foreground">x-mockifyer-client-id: wanderweird-demo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">gateway-api</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono">wander-api :4203</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">wander-api</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono">api.open-meteo.com</span>
                <span className="text-xs text-muted-foreground">(GET /v1/forecast)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">wander-api</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono">www.apicountries.com</span>
                <span className="text-xs text-muted-foreground">(GET /countries/name/...)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">wander-api</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-xs text-muted-foreground">also: frankfurter, adviceslip, bored-api, ...</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>gateway-api &amp; wander-api proxy runtime → Mockifyer dashboard :3002</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            The services start with <code className="bg-muted px-1 rounded">MOCKIFYER_RUNTIME=proxy</code>,{' '}
            <code className="bg-muted px-1 rounded">MOCKIFYER_PROXY_URL=http://127.0.0.1:3002</code> and{' '}
            <code className="bg-muted px-1 rounded">MOCKIFYER_ACTIVATION_MODE=client_id_header</code> (
            <code className="bg-muted px-1 rounded">dev:proxy:record</code> in the WanderWeird{' '}
            <code className="bg-muted px-1 rounded">package.json</code>). Each outbound call goes through the dashboard, 
            which decides per request whether to answer from a mock or pass it on live.
          </p>

          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <h4 className="font-semibold mb-2 text-blue-600 dark:text-blue-400">Demo data</h4>
            <p className="text-sm text-muted-foreground">
              Seeded by global setup: the scenarios <code className="bg-muted px-1 rounded">guide-demo-2</code> (Athens forecast mock, <strong>99°</strong>),{' '}
              <code className="bg-muted px-1 rounded">heatwave</code> (<strong>44°</strong>) and{' '}
              <code className="bg-muted px-1 rounded">rainy-weekend</code> (<strong>11°</strong>), plus a client lane{' '}
              <code className="bg-muted px-1 rounded">wanderweird-demo → guide-demo-2</code>. When wander-api gets any non-2xx 
              answer from Open-Meteo, it falls back to <strong>18°</strong> (<code className="bg-muted px-1 rounded">source: 'fallback'</code>).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Prerequisites (macOS)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>
              <strong className="text-foreground">Node 20.</strong> The workflow uses{' '}
              <code className="bg-muted px-1 rounded">node-version: '20'</code>, and the repo has no{' '}
              <code className="bg-muted px-1 rounded">.nvmrc</code>.
            </li>
            <li>
              <strong className="text-foreground">Playwright Chromium:</strong>{' '}
              <code className="bg-muted px-1 rounded">npx playwright install chromium</code>. In CI it's{' '}
              <code className="bg-muted px-1 rounded">--with-deps</code>.
            </li>
            <li>
              <strong className="text-foreground">ffmpeg isn't needed as a system install.</strong>{' '}
              <code className="bg-muted px-1 rounded">ffmpeg-static</code> is an e2e devDependency, and{' '}
              <code className="bg-muted px-1 rounded">FFMPEG_PATH</code> overrides it.
            </li>
            <li>
              <strong className="text-foreground">Free ports:</strong> 3002, 3012 (optional), 3022, 4200–4206 and 8090.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            3. Clone and install
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock code={`git clone https://github.com/sgedda/mockifyer && cd mockifyer
git checkout cursor/e2e-dashboard-gui-videos-7d37   # until #487 is merged
npm ci

# Build the Mockifyer packages (same as the CI step)
(
cd packages/mockifyer-core && npm ci && npm run build
cd ../mockifyer-axios && npm ci && npm run build
cd ../mockifyer-fetch && npm ci && npm run build
cd ../mockifyer-dashboard && npm ci && npm run build:backend
(cd frontend && npm ci && npm run build)
cd ../mockifyer-mcp && npm ci && npm run build
)

# Install the demo app
(
cd example-projects/wanderweird-travel
npm ci --legacy-peer-deps
cd apps/mobile && npm ci --legacy-peer-deps
)`} language="bash" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            4. Start the stack and run the tests
          </CardTitle>
          <CardDescription>
            Use one terminal per process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The commands are from <code className="bg-muted px-1 rounded">.github/workflows/e2e.yml</code>.
          </p>

          <div>
            <h4 className="font-semibold mb-2 text-sm">Starting the services</h4>
            <CodeBlock code={`# 1. Dashboard (sqlite) on :3002
cd example-projects/wanderweird-travel
npx mockifyer-dashboard --provider sqlite --path ./mock-data --port 3002 --host 127.0.0.1

# 2. Optional: second dashboard (branch build) on :3012 for main-features.spec.ts
mkdir -p /tmp/mockifyer-main-data
node packages/mockifyer-dashboard/bin/mockifyer-dashboard --provider sqlite \\
  --path /tmp/mockifyer-main-data --port 3012 --host 127.0.0.1      # run from the repo root

# 3. WanderWeird services in proxy mode (gateway :4200 ... wander-api :4203)
cd example-projects/wanderweird-travel && npm run dev:proxy:record

# 4. Expo web (Metro) on :8090, with the client id the dashboard lanes key on
cd example-projects/wanderweird-travel/apps/mobile
EXPO_PUBLIC_MOCKIFYER_CLIENT_ID=wanderweird-demo npx expo start --web --port 8090`} language="bash" />
          </div>

          <div>
            <h4 className="font-semibold mb-2 text-sm">Running the tests</h4>
            <CodeBlock code={`dev@wanderweird:~/mockifyer/e2e$ npm ci && npx playwright install chromium
dev@wanderweird:~/mockifyer/e2e$ npm test              # everything (API, app and GUI)
dev@wanderweird:~/mockifyer/e2e$ npm run test:gui      # dashboard GUI tests only (always recorded)
dev@wanderweird:~/mockifyer/e2e$ E2E_PRESENTATION=1 npm run test:gui   # slow, readable recordings
dev@wanderweird:~/mockifyer/e2e$ npm run artifacts     # side-by-side mp4 + .md per test, e2e-run-summary.md
dev@wanderweird:~/mockifyer/e2e$ npm run test:main     # main-features.spec.ts against :3012
dev@wanderweird:~/mockifyer/e2e$ npm run report        # Playwright HTML report`} language="bash" />
          </div>

          <div className="p-4 bg-muted rounded-md text-sm space-y-2">
            <p>
              <code className="bg-background px-1 rounded">global-setup.ts</code> stops early if a piece is down. 
              Override the URLs with <code className="bg-background px-1 rounded">APP_URL</code>,{' '}
              <code className="bg-background px-1 rounded">MOCKIFYER_DASHBOARD_URL</code>,{' '}
              <code className="bg-background px-1 rounded">GATEWAY_URL</code> or{' '}
              <code className="bg-background px-1 rounded">MAIN_DASHBOARD_URL</code>.{' '}
              <code className="bg-background px-1 rounded">npm run artifacts</code> writes{' '}
              <code className="bg-background px-1 rounded">gui-videos/&lt;spec&gt;--&lt;test&gt;.mp4</code> (1662×800, ffmpeg{' '}
              <code className="bg-background px-1 rounded">hstack</code>) plus a Markdown file per test.
            </p>
            <p>
              Presentation mode outlines the element being changed, holds 2.5 s before and after each value change, 
              types at 120 ms per key and holds 1 s on navigation clicks. The assertions are the same. Locally, 
              the six demo-stack GUI tests take about 45 s with it off and about 5 min with it on.
            </p>
            <p>
              In every GUI test, the dashboard opens on its start screen (Statistics) and reaches each page by clicking. 
              The app opens at its login screen in a fresh browser context, signs in as{' '}
              <code className="bg-background px-1 rounded">wanderer</code>, then clicks Discover and shows <strong>99°</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Walkthrough: one scenario per test</CardTitle>
          <CardDescription>
            Nine test scenarios demonstrating different features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.1 Mock editor: response body edit</h4>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>You'll see:</strong> sidebar Mocks, then search{' '}
                <code className="bg-muted px-1 rounded text-xs">latitude=37.9838</code>, Expand all, and click the 
                "forecast" card. In the Form Editor,{' '}
                <code className="bg-muted px-1 rounded text-xs">current → temperature_2m</code> = 37 → Save Changes. 
                The app goes from <strong>99° → 37°</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Asserts:</strong> the saved body is what the app shows after a refetch, and it's stored.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.2 Overrides page: field override</h4>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>You'll see:</strong> in Overrides, Add field override{' '}
                <code className="bg-muted px-1 rounded text-xs">current.temperature_2m</code> = 61 → Save overlays → Open mock.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Asserts:</strong> the app shows <strong>61°</strong>, while the stored body (and the editor) 
                still has <strong>99</strong>. The override changes only the value that's served.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.3 Status override 503</h4>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>You'll see:</strong> mock editor → Status Override = 503. The app shows <strong>18°</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Asserts:</strong> the proxy serves the 503, and wander-api uses its fallback weather.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.4 Settings: client lane</h4>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>You'll see:</strong> Settings → Client lanes, where the lane scenario goes heatwave → 
                rainy-weekend → guide-demo-2. The app shows <strong>44° → 11° → 99°</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Asserts:</strong> switching the lane's scenario moves the app with no restart and no code change.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.5 Header scenario picker (strict lanes)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>You'll see:</strong> the lane is removed and the header picker is set to heatwave. 
                The app keeps showing <strong>live</strong> weather, not 44°. Ticking "Lane global fallback" 
                moves it to <strong>44°</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Asserts:</strong> in strict lane mode (#484), a client with a client id but no lane 
                ignores the global scenario until you opt in to the fallback.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.6 Network view</h4>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>You'll see:</strong> the lane and header are both set to heatwave. Network is filtered 
                to the lane, then Clear and an app reload. The app shows <strong>44°</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Asserts:</strong> the trace lists the Open-Meteo <code className="bg-muted px-1 rounded text-xs">Mock</code> hop 
                under wander-api <code className="bg-muted px-1 rounded text-xs">GET /discover</code>.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.7 From scratch: mock only Open-Meteo</h4>
              <p className="text-sm text-muted-foreground mb-3">
                4 min 27 s in presentation mode. It uses its own empty dashboard on :3022.
              </p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>1.</strong> The start screen is empty ("Total Files 0"). The app's first load is all live, 
                  and nothing is stored. Mocks shows "No mocks found". Network shows{' '}
                  <code className="bg-muted px-1 rounded text-xs">Upstream</code> hops, and Hops is empty.
                </p>
                <p>
                  <strong>2.</strong> "Switch to default", then add the{' '}
                  <code className="bg-muted px-1 rounded text-xs">wanderweird-demo</code> lane. One app load with{' '}
                  <strong>Record: On</strong> (the default) stores a request-only placeholder per endpoint, with no bodies.
                </p>
                <p>
                  <strong>3.</strong> Set <strong>Record: Off</strong>. On Hops, expand{' '}
                  <code className="bg-muted px-1 rounded text-xs">GET /api/discover → GET /discover</code>, open the 
                  Open-Meteo <code className="bg-muted px-1 rounded text-xs">GET /v1/forecast</code> hop and choose{' '}
                  <strong>Use saved mock</strong>.
                </p>
                <p>
                  <strong>4.</strong> On the next load, the forecast is captured once and then served from the mock. 
                  Hops shows it as <code className="bg-muted px-1 rounded text-xs">Replay</code>. Network shows{' '}
                  <code className="bg-muted px-1 rounded text-xs">Mock</code> for{' '}
                  <code className="bg-muted px-1 rounded text-xs">/v1/forecast</code>, while{' '}
                  <code className="bg-muted px-1 rounded text-xs">/discover</code>, countries and advice stay{' '}
                  <code className="bg-muted px-1 rounded text-xs">Upstream</code>. The Domains tree shows 
                  api.open-meteo.com with "1 mocked" and every other host with "0 mocked".
                </p>
                <p>
                  <strong>5.</strong> Settings → Create New Scenario{' '}
                  <code className="bg-muted px-1 rounded text-xs">e2e-scratch-a</code> from default, then set it to 55°. 
                  Create <code className="bg-muted px-1 rounded text-xs">e2e-scratch-b</code> from A and set it to 66°. 
                  Switching the lane A ↔ B moves the app between <strong>55°</strong> and <strong>66°</strong>.
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Asserts:</strong> only the Open-Meteo mock has a stored body, and every other entry is a placeholder.
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                <strong>Note:</strong> the per-endpoint control needs the endpoint to be stored first. Network shows 
                live hops but has no per-endpoint toggle.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.8 Tracing walkthrough</h4>
              <p className="text-sm text-muted-foreground mb-3">
                4 min 23 s in presentation mode.
              </p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>1. Mock hit:</strong> in Network (lane{' '}
                  <code className="bg-muted px-1 rounded text-xs">wanderweird-demo</code>), turn Bodies on and Clear. 
                  In the Trace view, Collapse all, then expand{' '}
                  <code className="bg-muted px-1 rounded text-xs">GET /api/discover → GET /discover</code>. The 
                  Open-Meteo hop is <code className="bg-muted px-1 rounded text-xs">Mock</code>. Its Details show 
                  Source Mock, Status 200, Lane <code className="bg-muted px-1 rounded text-xs">wanderweird-demo</code>, 
                  the request header{' '}
                  <code className="bg-muted px-1 rounded text-xs">x-mockifyer-client-id: wanderweird-demo</code> and 
                  the body <code className="bg-muted px-1 rounded text-xs">"temperature_2m": 99</code>. wander-api{' '}
                  <code className="bg-muted px-1 rounded text-xs">GET /discover</code> is{' '}
                  <code className="bg-muted px-1 rounded text-xs">Upstream</code> (live).
                </p>
                <p>
                  <strong>2. Lane switch:</strong> with the lane set to heatwave, the app shows <strong>44°</strong> and 
                  the hop body is <code className="bg-muted px-1 rounded text-xs">"temperature_2m": 44</code>. Client 
                  connections shows Scenario (lane) heatwave and Last resolved heatwave.
                </p>
                <p>
                  <strong>3. 503 fallback:</strong> set Status Override = 503 in the mock editor. The app shows{' '}
                  <strong>18°</strong> and the Open-Meteo hop shows Status 503. wander-api's{' '}
                  <code className="bg-muted px-1 rounded text-xs">GET /discover</code> returns 200 with{' '}
                  <code className="bg-muted px-1 rounded text-xs">"source": "fallback"</code>,{' '}
                  <code className="bg-muted px-1 rounded text-xs">"temperature_2m": 18</code> and "Upstream 503".
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">5.9 Delay and status override on one endpoint</h4>
              <p className="text-sm text-muted-foreground mb-3">
                3.1 min in presentation mode. The test is in{' '}
                <code className="bg-muted px-1 rounded text-xs">dashboard-gui.spec.ts</code>, which runs the test{' '}
                <code className="bg-muted px-1 rounded text-xs">-g 'response delay and status'</code>.
              </p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>1.</strong> In the Request tab, set Response Delay = 2500 ms. Discover takes <strong>≥ 2500 ms</strong> and 
                  the app still shows <strong>99°</strong>. In the trace, the Open-Meteo hop has a Duration ≥ 2500 ms, 
                  and <code className="bg-muted px-1 rounded text-xs">GET /countries/name/greece</code> is{' '}
                  <code className="bg-muted px-1 rounded text-xs">Upstream</code> with 200 and &lt; 2500 ms.
                </p>
                <p>
                  <strong>2.</strong> Add Status Override 503 (the delay stays). The call takes ≥ 2500 ms and the app 
                  shows <strong>18°</strong>. The hop is 503, and the countries hop stays 200 and fast.
                </p>
                <p>
                  <strong>3.</strong> The API check: only the Athens mock of guide-demo-2 stores{' '}
                  <code className="bg-muted px-1 rounded text-xs">statusOverride 503 / responseDelayMs 2500</code>. 
                  Other mocks, including the heatwave copy of the same endpoint, are unchanged.
                </p>
                <p>
                  <strong>4.</strong> Clear the delay, and the app shows <strong>18°</strong> fast. Clear the status, 
                  and it shows <strong>99°</strong> fast.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. How to reproduce: demo helpers vs Mockifyer features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Demo and test helpers (not Mockifyer features)</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>
                <code className="bg-muted px-1 rounded">e2e/lib/*</code>:{' '}
                <code className="bg-muted px-1 rounded">gui.ts</code> (the{' '}
                <code className="bg-muted px-1 rounded">dash</code> fixture, presentation helpers{' '}
                <code className="bg-muted px-1 rounded">presentChange</code>,{' '}
                <code className="bg-muted px-1 rounded">presentationPause</code>,{' '}
                <code className="bg-muted px-1 rounded">holdForClip</code>),{' '}
                <code className="bg-muted px-1 rounded">docs.ts</code> (
                <code className="bg-muted px-1 rounded">documented(...)</code> step annotations),{' '}
                <code className="bg-muted px-1 rounded">setup.ts</code>/
                <code className="bg-muted px-1 rounded">stack.ts</code>, and{' '}
                <code className="bg-muted px-1 rounded">dashboard.ts</code> (a REST client used for setup and restore).
              </li>
              <li>
                <code className="bg-muted px-1 rounded">e2e/scripts/wander.sh</code>,{' '}
                <code className="bg-muted px-1 rounded">ww-service.sh</code> and{' '}
                <code className="bg-muted px-1 rounded">scratch-dashboard.sh</code> start, stop and pin services.{' '}
                <code className="bg-muted px-1 rounded">build-run-artifacts.ts</code> builds the clips and Markdown.
              </li>
              <li>
                <code className="bg-muted px-1 rounded">E2E_PRESENTATION=1</code>, which only sets the clip pacing.
              </li>
              <li>
                <code className="bg-muted px-1 rounded">afterEach</code>/
                <code className="bg-muted px-1 rounded">afterAll</code> restore the state. If a run is killed, 
                run <code className="bg-muted px-1 rounded">scripts/ww-service.sh gateway-api start</code>,{' '}
                <code className="bg-muted px-1 rounded">scripts/scratch-dashboard.sh stop</code> and{' '}
                <code className="bg-muted px-1 rounded">scripts/wander.sh start guide-demo-2</code>, then reset the lane:
                <CodeBlock code={`curl -X PUT -H 'content-type: application/json' -d '{"scenario":"guide-demo-2"}' \\
  http://127.0.0.1:3002/api/client-lanes/wanderweird-demo/scenario`} language="bash" className="mt-2" />
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Mockifyer features in use</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>
                <strong className="text-foreground">Proxy runtime:</strong>{' '}
                <code className="bg-muted px-1 rounded">MOCKIFYER_RUNTIME=proxy</code>,{' '}
                <code className="bg-muted px-1 rounded">MOCKIFYER_PROXY_URL</code> and{' '}
                <code className="bg-muted px-1 rounded">MOCKIFYER_ACTIVATION_MODE=client_id_header</code>.
              </li>
              <li>
                <strong className="text-foreground">Client id:</strong> the app sends{' '}
                <code className="bg-muted px-1 rounded">x-mockifyer-client-id</code> (set through{' '}
                <code className="bg-muted px-1 rounded">EXPO_PUBLIC_MOCKIFYER_CLIENT_ID</code>), and it travels 
                through the gateway and wander-api.
              </li>
              <li>
                <strong className="text-foreground">Scenarios and client lanes:</strong> a lane maps a client id 
                to a scenario. Lanes are strict by default, and "Lane global fallback" is opt-in.
              </li>
              <li>
                <strong className="text-foreground">Dashboard edits per mock:</strong> body edits, field overrides (
                <code className="bg-muted px-1 rounded">PATCH …/field-overrides</code>), Status Override, Response 
                Delay and replay mode ("Use saved mock").
              </li>
              <li>
                <strong className="text-foreground">Network trace:</strong> hops are linked by{' '}
                <code className="bg-muted px-1 rounded">X-Mockifyer-Request-Id</code> /{' '}
                <code className="bg-muted px-1 rounded">X-Mockifyer-Parent-Request-Id</code> (
                <code className="bg-muted px-1 rounded">parentRequestId</code>). They're readable in the Network 
                and Hops pages, through <code className="bg-muted px-1 rounded">/api/network-events</code> and{' '}
                <code className="bg-muted px-1 rounded">/api/network-events/trace</code>, and through the MCP tool{' '}
                <code className="bg-muted px-1 rounded">mockifyer_list_network_events</code> (
                <code className="bg-muted px-1 rounded">trace.spec.ts</code>).
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            7. Conclusion: what this shows for multi-service, nested setups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-1">•</span>
              <div>
                <strong className="text-foreground">Per-endpoint control with no code changes.</strong> One upstream 
                call three levels deep (app → gateway → wander-api → Open-Meteo) is mocked, edited, overridden or 
                delayed from the dashboard UI. The services stay unchanged and keep running.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-1">•</span>
              <div>
                <strong className="text-foreground">Scenarios shared across services through the client id.</strong> One 
                lane switch moves the whole chain (99 → 44 → 11), because every service resolves the same{' '}
                <code className="bg-muted px-1 rounded">x-mockifyer-client-id</code> to the same scenario.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-1">•</span>
              <div>
                <strong className="text-foreground">Surgical failure injection.</strong> A 503 or a 2500 ms delay 
                on the Open-Meteo hop only exercises wander-api's real fallback path (18°). Sibling calls such as 
                countries stay live, fast and at 200, and other mocks and scenarios keep their settings.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-1">•</span>
              <div>
                <strong className="text-foreground">Mixed mock and live in one request.</strong> The from-scratch 
                test ends with one mocked host and everything else live, and the trace marks each hop{' '}
                <code className="bg-muted px-1 rounded">Mock</code> or{' '}
                <code className="bg-muted px-1 rounded">Upstream</code>.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-1">•</span>
              <div>
                <strong className="text-foreground">A trace across services.</strong> The Network trace nests the 
                Open-Meteo hop under <code className="bg-muted px-1 rounded">GET /discover</code> under{' '}
                <code className="bg-muted px-1 rounded">GET /api/discover</code>, with the lane, status, duration 
                and bodies, so you can see which hop was mocked and why the app shows what it shows.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-1">•</span>
              <div>
                <strong className="text-foreground">Checked end to end.</strong> Each GUI test ends on the value 
                in the app's Temperature tile, not only on the dashboard state.
              </div>
            </li>
          </ul>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-md mt-6">
            <h4 className="font-semibold mb-2 text-amber-900 dark:text-amber-200">
              Limits (as of #487)
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>
                Atlas's live trace (<code className="bg-muted px-1 rounded">t</code> in Metro) is hosted in Metro 
                middleware. Running it outside Metro (Vite, Express) is in the backlog as SGE-60. The dashboard 
                Network trace works without Metro.
              </li>
              <li>
                The app has no loading indicator on refetch, so the delay shows up as hop Duration and as the 
                measured request time.
              </li>
              <li>
                Only 503 is tested. wander-api falls back on any non-2xx answer, so other codes would look the 
                same in the app.
              </li>
              <li>
                Lanes are strict by default: a client with a client id but no lane doesn't follow the global 
                scenario unless you turn on "Lane global fallback".
              </li>
              <li>
                <code className="bg-muted px-1 rounded">main-features.spec.ts</code> (status and delay through 
                REST/MCP, explain-value) needs the branch-built dashboard on :3012, because the demo runs the 
                published 1.5.92.
              </li>
              <li>
                The tests drive the Expo <strong>web</strong> build, not native React Native code paths. The suite 
                isn't hermetic: it needs a live stack, runs serially and calls real public APIs where nothing is mocked.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
