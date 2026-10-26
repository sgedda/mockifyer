# Mockifyer e2e (Playwright)

Headless end-to-end checks that Mockifyer really works across a running app: an edit in the dashboard
(or through the MCP server) must show up in the WanderWeird app, scenario switches must move it, and the
app must keep rendering from mocks when a backend is down.

## Scope (honest)

- Drives the **Expo web build** of WanderWeird in headless Chromium. It exercises the same Mockifyer
  clients, proxy runtime and dashboard, but **not** native React Native code paths (native HTTP stack,
  RN fetch/axios patching on a device). That belongs in Maestro flows later.
- Talks to a **live demo stack**; it is not hermetic. Tests run serially (1 worker) and every test
  restores what it changes.

## What must be running

| Piece | Default URL | Override env |
|---|---|---|
| Expo web app (Metro) | http://127.0.0.1:8090 | `APP_URL` |
| Mockifyer dashboard, sqlite provider | http://127.0.0.1:3002 | `MOCKIFYER_DASHBOARD_URL` |
| WanderWeird services (gateway :4200 … wander-api :4203), proxy runtime, pinned to `guide-demo-2` | http://127.0.0.1:4200 | `GATEWAY_URL` |

Demo data: scenarios `guide-demo-2` (Atlantis 99°), `heatwave` (44°), `rainy-weekend` (11°), client lane
`wanderweird-demo` → `guide-demo-2` (see the guide, section 4.14). `global-setup.ts` fails fast if a
piece is down. The MCP tests use `../packages/mockifyer-mcp/dist/cli.js` (build it first).

## Run

```bash
cd e2e
npm install
npx playwright install chromium
npm test                      # headless
npm run test:headed           # watch it in a browser window
npx playwright test tests/scenarios.spec.ts
npm run report                # HTML report; traces/videos/screenshots are kept on failure
```

## Tests

| File | What it checks |
|---|---|
| `dashboard.spec.ts` | scenarios, mocks and client lanes are listed; Settings UI shows the lane select; PUT without fields → 400 |
| `overrides.spec.ts` | `PUT /api/mocks/<file> {responseData}`, `PATCH …/field-overrides`, and MCP `mockifyer_set_field_overrides` each change the temperature shown in the app |
| `scenarios.spec.ts` | lane switch heatwave → rainy-weekend → base moves the app 44° → 11° → 99°; lane wins over global (`lane_redis`); a pinned service ignores its lane (`body_override`); `POST /api/scenario-config/create` clones mocks, resets them to live API (`passthrough`) and switches global; “Use saved mock” (`replayMode: stored`); delete |
| `offline.spec.ts` | wander-api stopped: app still renders Atlantis from saved mocks; with mocks on live API the gateway answers a 5xx JSON error instead of crashing |
| `trace.spec.ts` | an app load logs a `mock-hit` for Open-Meteo with `parentRequestId`; MCP `mockifyer_list_network_events` returns it |
| `dates.spec.ts` | scenario `fixedDate` set / invalid → 400 / clear; client-lane `fixedDate` set and clear (API level only: the app computes dates from the browser clock) |
| `main-features.spec.ts` | features on `main` newer than the demo's installed dashboard 1.5.92: status/delay overrides (#476, REST + MCP `mockifyer_set_mock_behavior`) and explain-value (#477, REST + MCP `mockifyer_explain_value`) |

### Known gaps (marked `test.fail`, so the suite stays green and flips to "unexpected pass" when fixed)

- **Header Scenario picker doesn't move a client with a clientId** (strict lane mode, no fallback to the
  global scenario). `scenarios.spec.ts`.
- **Proxy runtime ignores `statusOverride` / `responseDelayMs`** on main: only the in-process
  axios/fetch clients apply them; `POST /api/proxy` returns the stored status with no delay, so a
  proxy-mode app like WanderWeird can't show a 503 yet. `main-features.spec.ts`.

## State reset

- Field/body edits: `afterEach` writes back the original `responseData` and clears field overrides, then
  waits until the gateway serves 99° again.
- Lanes/global: `afterEach`/`afterAll` set lane and global back to `guide-demo-2`.
- wander-api: scenario and offline tests restart it via `scripts/wander.sh` (unpinned to follow the lane,
  or stopped), and always restart it **pinned to `guide-demo-2`** at the end. Offline tests also restore
  the replay modes of the two wander `/discover` mocks.
- Temporary scenario `e2e-tmp-*` is deleted in `afterAll`. Dates are restored to their prior values.
- If a run is killed mid-test: `scripts/wander.sh start guide-demo-2`, then set the lane back with
  `curl -X PUT -H 'content-type: application/json' -d '{"scenario":"guide-demo-2"}' http://127.0.0.1:3002/api/client-lanes/wanderweird-demo/scenario`.

## Testing main

The demo stack runs the published dashboard 1.5.92, which predates PRs #476/#477, so those tests skip
unless you point them at a dashboard built from main, ideally on a **copy** of the demo DB:

```bash
git clone https://github.com/sgedda/mockifyer mockifyer-main && cd mockifyer-main/packages
(cd mockifyer-core && npm i && npm run build)
(cd mockifyer-dashboard && npm i && npx tsc && mkdir -p public && echo ok > public/index.html)  # API only
(cd mockifyer-mcp && npm i && npm run build)
# copy mock-data/ (sqlite backup of mockifyer-dashboard.db + scenario-config.json) to ../main-data, then
node mockifyer-dashboard/dist/cli.js --provider sqlite --path ../main-data --port 3012 --host 127.0.0.1 &
cd <this e2e folder>
MAIN_DASHBOARD_URL=http://127.0.0.1:3012 MAIN_MCP_CLI=<path>/mockifyer-mcp/dist/cli.js npx playwright test tests/main-features.spec.ts
```

## CI

`ci.workflow.example.yml` is a **draft** GitHub Actions workflow (not in `.github/workflows`). It starts
the stack, waits for the ports, runs the suite and uploads the report/traces/videos. It still needs a way
to seed the demo scenarios on the runner (marked TODO).
