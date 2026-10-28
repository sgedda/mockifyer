import { expect, type Page } from '@playwright/test';
import { test, holdForClip, openAppFromLogin, SIMULATION, PRESENTATION } from '../lib/gui';
import { ACTOR } from '../lib/docs';
import { followLaneAndWait, pinToBaseAndWait } from '../lib/stack';
import { expectTemperature, temperatureTile, timedRefetchDiscover } from '../lib/app';
import {
  BASE_TEMP,
  browserApp,
  DEMO_GUI_TESTS,
  demoGuiDoc,
  expectOpenMeteoHop,
  loadAthensMock,
  NAV,
  expectOtherMocksUnchanged,
  otherMocksSimulation,
  RESPONSE_DELAY_MS,
  restoreDemo,
  storedAthensMock,
  traceAppLoad,
  UPSTREAM_ERROR_STATUS,
  type AthensMock,
} from '../lib/gui-demo';
import { ATHENS_ENDPOINT_PREFIX, BASE_SCENARIO, EXPECTED_TEMP, LANE, WANDER_DISCOVER_URL, WANDER_FALLBACK_TEMP } from '../lib/env';

// Each test changes something in the real dashboard UI (`dash`, desktop context) and then asserts the
// new value on screen in the app (`page`). Both pages are recorded; CI puts the two videos side by side.
// wander-api follows the client lane for this file, so lane and global switches reach the app.
// The tests in DEMO_GUI_TESTS (lib/gui-demo.ts) also run on Android (tests/android-gui.spec.ts).
/** Scenarios whose network log the tracing walkthrough switches to "Bodies on" (restored in afterEach). */
const TRACE_SCENARIOS = [BASE_SCENARIO, 'heatwave'];
const TRACING_TIMEOUT_MS = PRESENTATION ? 600_000 : 180_000;

const { dashboardUi: UI, app: APP, dashboardApi: API } = ACTOR;

/** Re-open Discover until the app shows n, then keep it on screen for the clip. */
const appShows = (page: Page, n: number) => browserApp(page).shows(n);

/** Steps every GUI test shares around its own: the app on the base value first, state restored after. */
const gui = demoGuiDoc([
  [APP, 'Login screen: the app opens at / in a fresh browser context (no stored session), its only direct URL load'],
  [APP, 'Type the demo user "wanderer" into the username field and the demo password into the password field, click Sign in'],
  [APP, `Click the Discover tab: the Atlantis Boardwalk card's Temperature tile shows ${BASE_TEMP}° (Open-Meteo mock, scenario ${BASE_SCENARIO})`],
]);

test.describe('dashboard GUI drives the app', { tag: '@gui' }, () => {
  let athens: AthensMock;

  test.beforeAll(async () => {
    athens = await loadAthensMock();
    await followLaneAndWait();
  });
  test.afterEach(() => restoreDemo(athens, TRACE_SCENARIOS));
  test.afterAll(pinToBaseAndWait);

  // Requesting `dash` here opens the dashboard start screen before the app loads, so both recordings
  // start together and the app login is on screen next to the dashboard start screen.
  test.beforeEach(async ({ page, dash }) => {
    await expect(dash.page.getByRole('heading', { name: 'Total Files' })).toBeVisible();
    await openAppFromLogin(page);
    await expectTemperature(page, BASE_TEMP);
  });

  test(DEMO_GUI_TESTS.bodyEdit.title, gui(DEMO_GUI_TESTS.bodyEdit.asserts, DEMO_GUI_TESTS.bodyEdit.steps), ({ page, dash }) =>
    DEMO_GUI_TESTS.bodyEdit.run({ dash, app: browserApp(page), athens }));

  test(DEMO_GUI_TESTS.fieldOverride.title, gui(DEMO_GUI_TESTS.fieldOverride.asserts, DEMO_GUI_TESTS.fieldOverride.steps), ({ page, dash }) =>
    DEMO_GUI_TESTS.fieldOverride.run({ dash, app: browserApp(page), athens }));

  test('mock editor: response delay and status override on the Open-Meteo endpoint only', gui(
    `Per-endpoint Response Delay and Status Override on the Open-Meteo mock: the app's Discover call takes at least the delay and still shows its value, a 503 makes wander-api fall back (${WANDER_FALLBACK_TEMP}°), both combine, and clearing them brings back ${BASE_TEMP}° at normal speed; other endpoints keep their timing and status, and only this mock stores the settings.`,
    [
      NAV.athensMock,
      [UI, `Request tab > Response Simulation > Response Delay (ms) = ${RESPONSE_DELAY_MS} (saved on blur), toast: Response delay set to ${RESPONSE_DELAY_MS}ms`],
      [UI, `${NAV.network[1]}; Clear`],
      [APP, `Refetch Discover: the Discover request takes >= ${RESPONSE_DELAY_MS} ms (measured in the browser) and the tile still shows ${BASE_TEMP}°; there is no loading indicator on a refetch, the old card stays until the answer arrives`],
      [UI, `Trace (Paused, Collapse all, expand GET /api/discover -> GET /discover): Open-Meteo hop Mock, Status 200, Duration >= ${RESPONSE_DELAY_MS} ms; GET /countries/name/greece Upstream, Status 200, Duration < ${RESPONSE_DELAY_MS} ms`],
      [UI, `Back to the mock editor (same navigation): Status Override = ${UPSTREAM_ERROR_STATUS}, delay kept`],
      [UI, `${NAV.network[1]}; Clear`],
      [APP, `Refetch Discover: >= ${RESPONSE_DELAY_MS} ms and the tile shows ${WANDER_FALLBACK_TEMP}° (wander-api's fallback weather for any non-2xx answer)`],
      [UI, `Trace: Open-Meteo hop Status ${UPSTREAM_ERROR_STATUS}, Duration >= ${RESPONSE_DELAY_MS} ms; countries hop Status 200, Duration < ${RESPONSE_DELAY_MS} ms`],
      [API, `The Athens forecast mock of ${BASE_SCENARIO} stores statusOverride ${UPSTREAM_ERROR_STATUS} / responseDelayMs ${RESPONSE_DELAY_MS}; every other mock there, and the heatwave copy of the same endpoint, keeps the settings it had before the test`],
      [UI, 'Back to the mock editor: Response Delay Clear, toast: Response delay cleared'],
      [APP, `Refetch Discover: < ${RESPONSE_DELAY_MS} ms, still ${WANDER_FALLBACK_TEMP}° (status override alone)`],
      [UI, 'Status Override Clear, toast: Status override cleared'],
      [APP, `Refetch Discover: < ${RESPONSE_DELAY_MS} ms and ${BASE_TEMP}° (the stored value)`],
      [API, 'The mock stores neither override any more'],
    ],
  ), async ({ page, dash }) => {
    test.setTimeout(TRACING_TIMEOUT_MS);
    /** One timed app load: the Discover request time and the value it brings, kept on screen. */
    async function timedLoad(appValue: number) {
      const ms = await timedRefetchDiscover(page);
      await expectTemperature(page, appValue);
      await holdForClip(temperatureTile(page));
      return ms;
    }
    /** In a fresh trace: the Open-Meteo hop's status and duration, and a sibling hop that stays fast and 200. */
    async function expectOnlyOpenMeteoAffected(status: number) {
      let ms = 0;
      await expectOpenMeteoHop(dash, async () => {
        ms = await timedLoad(status === 200 ? BASE_TEMP : WANDER_FALLBACK_TEMP);
      }, { status, delayed: true });
      expect(ms).toBeGreaterThanOrEqual(RESPONSE_DELAY_MS);
    }
    const othersBefore = await otherMocksSimulation(athens);

    // Delay only: slower, same value.
    await dash.openAthensMock(athens.file);
    await dash.setResponseSimulation(SIMULATION.delay, RESPONSE_DELAY_MS);
    await dash.openNetworkForLane();
    await expectOnlyOpenMeteoAffected(200);

    // Delay + 503: slower and wander-api's fallback.
    await dash.openAthensMock(athens.file);
    await dash.setResponseSimulation(SIMULATION.status, UPSTREAM_ERROR_STATUS);
    await dash.openNetworkForLane();
    await expectOnlyOpenMeteoAffected(UPSTREAM_ERROR_STATUS);

    // Stored on this one mock only: every other mock (and the heatwave copy of this endpoint) is unchanged.
    expect(await storedAthensMock(athens)).toMatchObject({ statusOverride: UPSTREAM_ERROR_STATUS, responseDelayMs: RESPONSE_DELAY_MS });
    await expectOtherMocksUnchanged(athens, othersBefore);

    // Clear the delay (503 alone), then the status: back to the stored value at normal speed.
    await dash.openAthensMock(athens.file);
    await dash.setResponseSimulation(SIMULATION.delay, null);
    expect(await timedLoad(WANDER_FALLBACK_TEMP)).toBeLessThan(RESPONSE_DELAY_MS);
    await dash.setResponseSimulation(SIMULATION.status, null);
    expect(await timedLoad(BASE_TEMP)).toBeLessThan(RESPONSE_DELAY_MS);
    const cleared = await storedAthensMock(athens);
    expect([cleared.statusOverride ?? null, cleared.responseDelayMs ?? null]).toEqual([null, null]);
  });

  test('Settings client lane: heatwave 44 -> rainy-weekend 11 -> base 99 in the app', gui(
    'Switching the demo client lane scenario in Settings moves the app between the scenario values.',
    [
      NAV.clientLanes,
      [UI, 'Client lanes: "Scenario for wanderweird-demo" select = heatwave, toast: Lane "wanderweird-demo" updated.'],
      [APP, 'Refetch until 44°'],
      [UI, 'Same select = rainy-weekend'],
      [APP, 'Refetch until 11°'],
      [UI, `Same select = ${BASE_SCENARIO}`],
      [APP, `Refetch until ${BASE_TEMP}°`],
    ],
  ), async ({ page, dash }) => {
    await dash.openClientLanes();
    for (const scenario of ['heatwave', 'rainy-weekend', BASE_SCENARIO]) {
      await dash.setLaneScenario(scenario);
      await appShows(page, EXPECTED_TEMP[scenario]);
    }
  });

  test(DEMO_GUI_TESTS.headerPicker.title, gui(DEMO_GUI_TESTS.headerPicker.asserts, DEMO_GUI_TESTS.headerPicker.steps), ({ page, dash }) =>
    DEMO_GUI_TESTS.headerPicker.run({ dash, app: browserApp(page), athens }));

  test('Network view: an app load shows the Open-Meteo mock hit and the wander-api hop', gui(
    'After an app load the Network trace lists the Open-Meteo mock hit and the wander-api hop for the demo lane.',
    [
      NAV.clientLanes,
      [UI, 'Client lanes: lane scenario = heatwave'],
      [APP, 'Refetch until 44°'],
      [UI, 'Header Scenario picker (top right) -> heatwave (the Network view lists the header scenario; the lane still decides what the app gets)'],
      NAV.network,
      [UI, 'Clear, toast: Network log cleared for this scope; no Mock GET /v1/forecast row'],
      [APP, 'Refetch until 44° (new app load)'],
      [UI, 'Trace shows a "Mock" GET /v1/forecast row and an "Upstream" GET /discover row; Details show http://127.0.0.1:4203/discover and the Open-Meteo URL'],
    ],
  ), async ({ page, dash }) => {
    await dash.openClientLanes();
    await dash.setLaneScenario('heatwave');
    await appShows(page, EXPECTED_TEMP.heatwave);
    // The Network view lists hops of the header scenario; the lane still decides what the app gets.
    await dash.pickHeaderScenario('heatwave');
    await dash.openNetworkForLane();
    await dash.clearNetworkLog();
    const mockHit = dash.networkHop('Mock', 'GET /v1/forecast').first();
    const wanderHop = dash.networkHop('Upstream', 'GET /discover').first();
    await expect(mockHit).toBeHidden();
    await appShows(page, EXPECTED_TEMP.heatwave);
    await expect(mockHit).toBeVisible({ timeout: 20_000 });
    await expect(wanderHop).toBeVisible();
    await dash.selectHop(wanderHop, WANDER_DISCOVER_URL);
    await dash.selectHop(mockHit, ATHENS_ENDPOINT_PREFIX);
  });

  test('tracing walkthrough: Network trace and Details for a mock hit, a lane switch and a 503 fallback', gui(
    'Real app traffic traced in the dashboard: the nested Open-Meteo hop is served from the mock with the value the app shows (99°), a lane switch to heatwave resolves to that scenario (44°), and a 503 status override shows up on the hop while wander-api falls back (18°).',
    [
      [UI, `(a) ${NAV.network[1]}; "Bodies off" -> "Bodies on" (store body previews for ${BASE_SCENARIO}); Clear`],
      [APP, `Refetch Discover: ${BASE_TEMP}°`],
      [UI, 'Trace view: Collapse all; expand GET /api/discover (gateway) -> GET /discover (wander-api); the Open-Meteo GET /v1/forecast hop under it is "Mock"'],
      [UI, `Click the Open-Meteo hop -> Details: URL, Source Mock, Status 200, Duration, Lane ${LANE}; Request headers carry x-mockifyer-client-id: ${LANE}; Response body has "temperature_2m": ${BASE_TEMP}`],
      [UI, `Click wander-api GET /discover -> Details: Source Upstream (live), Status 200; Response body is the Discover payload with "temperature_2m": ${BASE_TEMP}`],
      [UI, '(b) ' + NAV.clientLanes[1] + '; lane scenario = heatwave'],
      [APP, `Refetch until ${EXPECTED_TEMP.heatwave}°`],
      [UI, 'Header Scenario picker -> heatwave (the Network view lists the header scenario); sidebar Network: "Bodies on" for heatwave, Clear'],
      [APP, `Refetch Discover: ${EXPECTED_TEMP.heatwave}°`],
      [UI, `Trace: expand GET /api/discover -> GET /discover; Open-Meteo hop "Mock" -> Details Source Mock, Lane ${LANE}; Response body "temperature_2m": ${EXPECTED_TEMP.heatwave}`],
      [UI, `Header "Client connections": ${LANE} has Scenario (lane) heatwave and Last resolved heatwave`],
      [UI, `(c) Client lanes: lane scenario = ${BASE_SCENARIO}; header picker -> ${BASE_SCENARIO}`],
      [UI, NAV.athensMock[1] + `; Request tab, Status Override = ${UPSTREAM_ERROR_STATUS}`],
      [APP, `Refetch until ${WANDER_FALLBACK_TEMP}° (wander-api fallback weather)`],
      [UI, `${NAV.network[1]}; Clear`],
      [APP, `Refetch Discover: ${WANDER_FALLBACK_TEMP}°`],
      [UI, `Trace: expand GET /api/discover -> GET /discover; Open-Meteo hop "Mock" -> Details Status ${UPSTREAM_ERROR_STATUS}`],
      [UI, `Click wander-api GET /discover -> Details: Status 200; Response body has "source": "fallback", "temperature_2m": ${WANDER_FALLBACK_TEMP} and the upstream error "Upstream ${UPSTREAM_ERROR_STATUS}"`],
    ],
  ), async ({ page, dash }) => {
    test.setTimeout(TRACING_TIMEOUT_MS);
    const traceFreshLoad = (appValue: number) => traceAppLoad(dash, () => appShows(page, appValue));

    // (a) Open-Meteo served from the mock under wander-api GET /discover.
    await dash.openNetworkForLane();
    await dash.setNetworkBodies(true);
    let { wanderRow, forecastRow } = await traceFreshLoad(BASE_TEMP);
    await dash.selectHop(forecastRow, ATHENS_ENDPOINT_PREFIX);
    await dash.expectDetail('Source', 'Mock');
    await dash.expectDetail('Status', '200');
    await dash.expectDetail('Duration', /\d+ ms/);
    await dash.expectDetail('Lane', LANE);
    await dash.expectDetailBlock('Request headers', `x-mockifyer-client-id: ${LANE}`);
    await dash.expectDetailBlock('Response body', `"temperature_2m": ${BASE_TEMP}`);
    await dash.selectHop(wanderRow, WANDER_DISCOVER_URL);
    await dash.expectDetail('Source', 'Upstream');
    await dash.expectDetail('Status', '200');
    await dash.expectDetailBlock('Response body', `"temperature_2m": ${BASE_TEMP}`);

    // (b) The same call after a lane switch to heatwave.
    await dash.openClientLanes();
    await dash.setLaneScenario('heatwave');
    await appShows(page, EXPECTED_TEMP.heatwave);
    await dash.pickHeaderScenario('heatwave');
    await dash.openNetworkForLane();
    await dash.setNetworkBodies(true);
    ({ wanderRow, forecastRow } = await traceFreshLoad(EXPECTED_TEMP.heatwave));
    await dash.selectHop(forecastRow, ATHENS_ENDPOINT_PREFIX);
    await dash.expectDetail('Source', 'Mock');
    await dash.expectDetail('Lane', LANE);
    await dash.expectDetailBlock('Response body', `"temperature_2m": ${EXPECTED_TEMP.heatwave}`);
    await dash.expectClientConnection('heatwave');

    // (c) A 503 status override on the Open-Meteo mock; wander-api falls back.
    await dash.openClientLanes();
    await dash.setLaneScenario(BASE_SCENARIO);
    await dash.pickHeaderScenario(BASE_SCENARIO);
    await dash.openAthensMock(athens.file);
    await dash.setResponseSimulation(SIMULATION.status, UPSTREAM_ERROR_STATUS);
    await appShows(page, WANDER_FALLBACK_TEMP);
    await dash.openNetworkForLane();
    ({ wanderRow, forecastRow } = await traceFreshLoad(WANDER_FALLBACK_TEMP));
    await dash.selectHop(forecastRow, ATHENS_ENDPOINT_PREFIX);
    await dash.expectDetail('Status', String(UPSTREAM_ERROR_STATUS));
    await dash.selectHop(wanderRow, WANDER_DISCOVER_URL);
    await dash.expectDetail('Status', '200');
    await dash.expectDetailBlock('Response body', '"source": "fallback"');
    await dash.expectDetailBlock('Response body', `"temperature_2m": ${WANDER_FALLBACK_TEMP}`);
    await dash.expectDetailBlock('Response body', `Upstream ${UPSTREAM_ERROR_STATUS}`);
  });
});
