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

## Run locally

```bash
cd e2e
npm install
npx playwright install chromium

# First time: seed demo data (dashboard must be running on :3002)
npm run seed

# Then run tests
npm test                      # headless
npm run test:headed           # watch it in a browser window
npx playwright test tests/scenarios.spec.ts
npm run report                # HTML report; traces/videos/screenshots are kept on failure

# Dashboard GUI tests only (always recorded), then the side-by-side clips and run docs
npm run test:gui              # same as: npx playwright test --project=gui  (or --grep @gui)
npm run artifacts             # gui-videos/*.mp4 + *.md, e2e-run-summary.md, other-tests/*.md, individual/*.webm
npx playwright test --project=gui --headed   # watch both windows
E2E_PRESENTATION=1 npm run test:gui          # presentation mode: slow, readable GUI recordings
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
| `dashboard-gui.spec.ts` (`@gui`) | the real dashboard UI changes what the app shows; see below |

### Dashboard GUI tests (`@gui`, project `gui`)

Every other spec drives the dashboard through its HTTP API (`lib/dashboard.ts`). These six tests (plus the
from-scratch test below) use the
**dashboard UI** like a user would, in a second browser context (1280×800, so the sidebar is shown), while
the app runs in the first (`page`, 430×900). Each test ends by asserting the **new value on screen in the
app**, so the recording shows the change travel from the dashboard to the app.

| Test | Dashboard UI steps | App shows |
|---|---|---|
| mock editor: response body | Mocks editor (`/mock`), Form Editor, `current` → `temperature_2m` = 37, Save Changes | 99° → 37° |
| overrides page: field override | Overrides, Add field override `current.temperature_2m` = 61, Save overlays, then Open mock | 61°, while the editor still shows the stored 99 |
| mock editor: delay and status override (Open-Meteo only) | Request tab, Response Delay 2500 ms; then Status Override 503 (delay kept); then Clear each; Network trace for the first two | 99° after ≥ 2.5 s (hop Duration ≥ 2500 ms) → 18° after ≥ 2.5 s (hop 503) → 18° fast → 99° fast; the countries hop stays 200 and fast; only this mock stores the settings |
| Settings client lane | Settings > Client lanes, lane scenario select heatwave → rainy-weekend → guide-demo-2 | 44° → 11° → 99° |
| header Scenario picker | remove the lane, header picker → heatwave, then tick "Lane global fallback" | strict default (#484): live weather, not 44°; with the fallback on: 44° |
| Network view | lane → heatwave, header → heatwave, Network filtered to the lane, Clear, app reload | 44°, and the trace lists the Open-Meteo `Mock` hop under wander-api `GET /discover` |
| tracing walkthrough | Network: Bodies on, Clear, Paused, Trace: Collapse all → expand `GET /api/discover` → `GET /discover` → Open-Meteo hop; Details (Source, Status, Duration, Lane, Request headers, Response body); Client connections; then a heatwave lane switch and a 503 status override | 99° (body `"temperature_2m": 99`, Mock) → 44° (heatwave, Last resolved heatwave) → 18° (Open-Meteo hop 503, wander-api body `"source": "fallback"`) |

Both panes start at their entry screen, and the two recordings start together: the GUI `beforeEach`
requests the dashboard first, so it waits on its start screen while the app signs in. The **app** opens
at its login screen in a fresh browser context (no stored session), types the demo user and password
into the form, clicks Sign in, then clicks the Discover tab to reach the Atlantis Temperature tile.
Only then do the dashboard steps start; app and dashboard steps are not interleaved during login.

The dashboard starts on its **start screen** (`/`, Statistics): that is its only direct URL load.
The target page is then reached by clicks a user would make, and each one is listed as a step in the
test's Markdown:
- the mock editor: sidebar Mocks, search `latitude=37.9838`, Expand all, the "forecast" card;
- Overrides: sidebar Overrides, the "Open mock for overlays" picker filtered to the Athens forecast, Edit overlays;
- Client lanes: sidebar Settings, scroll to the Client lanes card;
- the header Scenario picker (top right);
- Network: sidebar Network, Client lane filter.

### From scratch (`dashboard-gui-scratch.spec.ts`)

A seventh GUI test starts with **completely empty data**: its own branch-built dashboard on `:3022` with a fresh
sqlite dir (`scripts/scratch-dashboard.sh`), and the gateway and wander-api restarted to proxy through it without
the record env (`scripts/ww-service.sh … start` with `MOCKIFYER_DASHBOARD_URL=http://127.0.0.1:3022 WW_RECORD=off`).
The app and the other services keep using the demo dashboard; `afterAll` puts the gateway and wander-api back and
deletes the scratch data, so the test is idempotent and the shared stack is unaffected.

The flow, all in the UI:
1. Empty start screen; the app's first Discover load is all live and stores nothing: no lane yet, so strict
   lane mode passes calls through. The test shows Mocks ("No mocks found"), Network (live hops) and Hops (empty).
2. Switch to `default`, then add the `wanderweird-demo` lane. One app load runs with the header **Record: On**
   (the default), which stores a request-only placeholder (no body, served live) per called endpoint.
3. Turn **Record** off. On the Hops page, expand `GET /api/discover` → `GET /discover`, open the Open-Meteo hop
   and choose **Use saved mock**. The next load captures that one response; Hops shows it as Replay, Network as
   Mock, and every other endpoint stays live.
4. Create scenario A from `default`, then B from A, each with its own temperature (55°, 66°). Switch the lane
   A ↔ B; the app follows.

Why the placeholder step: the dashboard's per-endpoint controls (a mock's replay mode, reached from a hop, or a
path folder's **Record response** in the Mocks › Domains tree) need the endpoint to be stored first, and the Hops
page lists stored entries only. The Network page shows live hops but has no per-endpoint toggle.

Tracing views in the dashboard UI: **Network** (`/network`; List / Trace / Waterfall / Gantt / Journey, plus a
**Details** pane with URL, Method, Source Mock/Upstream/Error, Transport, Request id, Triggered by, Status, Duration,
Lane, Call chain, Request/Response headers and, with **Bodies on** for that scenario, Request/Response body) and
**Hops** (`/hops`, stored chains; a hop opens its mock editor with Request / Response / Metadata tabs). The scenario
and lane resolution of a client is in the header's **Client connections** panel (Scenario (lane), Last resolved).
There is no separate "Atlas" trace page in the UI (`/atlas` redirects to Network). The tracing walkthrough uses the
Network trace: the demo's Athens forecast mock is stored without a parent link, so Hops does not nest it under
`GET /discover`, while the live trace does. The test turns Bodies on for `guide-demo-2` and `heatwave` and
`afterEach` turns them off again.

A date override test is not included: the app shows no date derived from the mocks, so there is nothing
to see change on screen (dates stay covered at API level in `dates.spec.ts`).

How it works: `lib/gui.ts` extends `test` with a `dash` fixture (dashboard context with its own
`recordVideo`, wrapped in a small page object). The video is attached to the result as `dashboard-video`;
Playwright's own `video` attachment is the app. The `gui` project in `playwright.config.ts` sets
`video: 'on'` (at the app's full size) and `trace: 'on'`, so GUI tests are recorded on **every** run; the
`chromium` project (everything else) keeps video and trace on failure only. Selectors are the dashboard's
existing labels, placeholders, `aria-label`s and the two `data-testid`s from #484; no frontend change was needed.

### Presentation mode (`E2E_PRESENTATION=1`)

Off by default: the GUI tests run at normal speed with short holds (0.5 s on each new app value, 0.75 s at
the end). With `E2E_PRESENTATION=1` (or `true`) the GUI tests, and only they, slow down at the moments
where a value changes, so the clips can be watched without slowing the video afterwards:

- the element being changed (input, select, checkbox, menu item, Save / Clear button, hop row) gets an
  orange outline, with a 2.5 s hold before the change and 2.5 s after it, while the toast is visible;
- values are typed key by key (`pressSequentially`, 120 ms per key) instead of filled;
- each navigation click (sidebar link, search, Expand all, list card, picker option) and each app login
  step (username, password, Sign in, Discover tab) is outlined, with a 1 s hold before and after it;
- each new value in the app (Temperature tile) is outlined and held for 2.5 s after the refetch shows it;
- navigation and page loads keep their normal speed; assertions are the same.

It is one helper set in `lib/gui.ts` (`presentChange`, `presentationPause`, `holdForClip`), a no-op or the
normal timing when the switch is off. Locally the six demo-stack GUI tests take about 45 s off and about 5 min on;
the from-scratch test about 30 s off.
CI turns it on for the nightly schedule and for manual runs (`presentation` input, default on) and off for
pull requests. The run summary and each test's Markdown file show a "Presentation mode" line and list
`E2E_PRESENTATION` with the other env.

### Side-by-side videos

`scripts/build-run-artifacts.ts` (`npm run artifacts`) reads the JSON report (`test-results/results.json`),
takes the last attempt of each test that has both an app and a dashboard video, and runs ffmpeg (the
`ffmpeg-static` devDependency, so no apt or system ffmpeg is needed; `FFMPEG_PATH` overrides it):

```
[0:v]scale=-2:800[app]; [1:v]scale=-2:800[dash]; [app][dash]hstack   ->  H.264 mp4, 1662×800
```

Output: `gui-videos/<spec>--<test title>.mp4` (app left, dashboard right) and the two source recordings
renamed after the test in `gui-videos/individual/<name>.app.webm` / `<name>.dashboard.webm`. The originals
stay in `test-results/` and the HTML report. Recordings contain only the two browser pages.

### Run docs (a Markdown description per recording)

The same script writes, from the JSON report plus `.github/workflows/e2e.yml`:

- `gui-videos/<name>.md` next to each `<name>.mp4`, and `gui-videos/other-tests/<name>.md` for every other
  test. Each has: result, duration, spec `file:line`, project and tags; where the videos and trace are in
  the CI artifacts; **what the test does and asserts**, step by step, labelled by who acts (Mockifyer
  dashboard UI, Mockifyer dashboard API, Mockifyer MCP server, WanderWeird app, helper); the **exact test
  command** (`config.argv` from the report), working directory and env (`CI`, `E2E_VIDEO`, `MAIN_*`, URL
  overrides, recorded in `playwright.config.ts` metadata with repo paths as `<repo>`); the **workflow steps**
  in order, each tagged Mockifyer / Demo app (WanderWeird) / Test run / Helper with its command; and the
  local reproduce commands (the workflow's Mockifyer, demo and wait steps, then
  `npx playwright test tests/<file>:<line> --project=<project>`).
- `gui-videos/e2e-run-summary.md`: run link, passed/failed/flaky/skipped counts, all tests with their
  "asserts" line, artifacts, workflow steps and reproduce commands. In CI it is also appended to
  `$GITHUB_STEP_SUMMARY` (the run's Summary page).

In CI the step list comes from the running job via the Actions API (`GITHUB_TOKEN`, `actions: read`), with
each step's status; elsewhere, or if that call fails, from the workflow YAML. The descriptions come from
annotations on each test: `documented(asserts, steps)` in `lib/docs.ts`, e.g.

```ts
test('Settings client lane: ...', documented('Switching the lane scenario in Settings moves the app.', [
  [ACTOR.dashboardUi, 'Settings > Client lanes: lane scenario select = heatwave'],
  [ACTOR.app, 'Refetch until 44°'],
]), async ({ page, dash }) => { /* ... */ });
```

API and app tests carry the one-line "asserts" annotation only. Any machine hostname is replaced by
`<host>` in the generated files.

## State reset

- Field/body edits: `afterEach` writes back the original `responseData` and clears field overrides, then
  waits until the gateway serves 99° again.
- Lanes/global: `afterEach`/`afterAll` set lane and global back to `guide-demo-2`.
- From scratch: `afterAll` restarts the gateway as `dev:proxy:record` does, stops the scratch dashboard,
  deletes its data dir and pins wander-api back to `guide-demo-2`.
- wander-api: scenario and offline tests restart it via `scripts/wander.sh` (unpinned to follow the lane,
  or stopped), and always restart it **pinned to `guide-demo-2`** at the end. Offline tests also restore
  the replay modes of the two wander `/discover` mocks.
- Temporary scenario `e2e-tmp-*` is deleted in `afterAll`. Dates are restored to their prior values.
- GUI tests: `afterEach` restores the Athens body, clears its status and field overrides, puts the lane
  (re-created if the test removed it) and global back on `guide-demo-2` and turns the lane global fallback
  off. The Network test clears the network log for `heatwave` + the demo lane only (telemetry, not restored).
- If a run is killed mid-test: `scripts/ww-service.sh gateway-api start`, `scripts/scratch-dashboard.sh stop`,
  `scripts/wander.sh start guide-demo-2`, then set the lane back with
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

The suite runs in GitHub Actions (`.github/workflows/e2e.yml`):
- **Schedule**: nightly at 3 AM UTC (records all videos, presentation mode on)
- **Manual**: via workflow_dispatch in the Actions tab (checkboxes: record all videos; presentation mode, default on)
- **Pull requests**: when touching dashboard, core, axios, fetch, MCP server, WanderWeird example, or e2e/
  (GUI tests always recorded at normal speed; other tests only on failure)

The workflow builds Mockifyer packages, starts the WanderWeird stack, runs the suite (global setup seeds the
demo data), composes the GUI clips and writes the run docs. Artifacts of every run
(pass or fail), retained for **30 days**, fixed names so a collector can `gh run download <run-id> -n <name>`:

| Artifact | Contents |
|---|---|
| `e2e-gui-videos` | one side-by-side mp4 per GUI test (app left, dashboard right) with its `.md` description of the same base name, `e2e-run-summary.md`, and `other-tests/*.md` |
| `e2e-videos` | individual recordings: `gui-videos/individual/*.{app,dashboard}.webm` plus any other test's video (failures, or all with `E2E_VIDEO=on`) |
| `e2e-report` | Playwright HTML report (`npx playwright show-report <dir>`) |
| `e2e-traces` | `trace.zip` per GUI test, plus traces of failed tests (`npx playwright show-trace <zip>`) |
| `e2e-logs` | on failure only: `test-results/` and the dashboard, services, Metro and wander-api logs |

Demo data seeding (`seed-demo-data.ts`) creates the three scenarios (guide-demo-2 99°, heatwave 44°,
rainy-weekend 11°) with an Open-Meteo Athens forecast mock and the wanderweird-demo client lane,
all via the real dashboard API. Idempotent and deterministic.
