import { expect, type Page } from '@playwright/test';
import { test, holdForClip, openAppFromLogin, PRESENTATION } from '../lib/gui';
import { ACTOR, documented } from '../lib/docs';
import { Dashboard } from '../lib/dashboard';
import { scratchStack } from '../lib/stack';
import {
  expectTemperatureAfterRefetch,
  expectTemperatureOtherThanAfterRefetch,
  shownTemperature,
  temperatureTile,
} from '../lib/app';
import { ATHENS_ENDPOINT_PREFIX, LANE, SCRATCH_DASHBOARD } from '../lib/env';

// From scratch: an EMPTY dashboard of its own (scripts/scratch-dashboard.sh, :3022) that the gateway and
// wander-api proxy through for this file only, without the record env. Only one endpoint, the Open-Meteo
// forecast, is switched to a stored mock in the UI; everything else stays live.
//
// What the dashboard offers for "mock one endpoint": a per-mock replay mode (mock editor, reached from a hop
// on the Hops page) and a per-path "Record response" rule (Mocks > Domains tree). Both need the endpoint to
// exist as a stored entry first, and the Hops page lists stored entries only. So one app load runs with
// Record On, which stores request-only placeholders (no response body, served Live) for the endpoints the
// app calls; Record is then switched Off and only the forecast is turned into a saved mock.
test.use({ dashboardUrl: SCRATCH_DASHBOARD });

const scratch = new Dashboard(SCRATCH_DASHBOARD);
const SCENARIO_A = 'e2e-scratch-a';
const SCENARIO_B = 'e2e-scratch-b';
const TEMP_A = 55;
const TEMP_B = 66;
const FORECAST_HOP = /^GET \/v1\/forecast\?latitude=37\.9838/;
/** The Discover screen's chain: gateway GET /api/discover -> wander-api GET /discover -> Open-Meteo, countries, ... */
const GATEWAY_DISCOVER_HOP = /^GET \/api\/discover\?destinationKey=atlantis/;
const DISCOVER_HOP = /^GET \/discover\?destinationKey=atlantis/;
const CAPTURE_NEXT_TOAST = 'No saved body yet — the next request will capture from live, then this mock will be served.';
const SERVE_SAVED_TOAST = 'This mock will be served from Mockifyer.';
const SCRATCH_TIMEOUT_MS = PRESENTATION ? 600_000 : 240_000;

const { dashboardUi: UI, app: APP, dashboardApi: API, helper: HELPER } = ACTOR;

/** Re-open Discover until the app shows n, then keep it on screen for the clip. */
async function appShows(page: Page, n: number) {
  await expectTemperatureAfterRefetch(page, n);
  await holdForClip(temperatureTile(page));
}

/** Re-open Discover until the app shows any temperature (live weather, or wander-api's fallback). */
async function appShowsSomeTemperature(page: Page) {
  await expectTemperatureOtherThanAfterRefetch(page);
  await holdForClip(temperatureTile(page));
}

/** Mocks stored in a scenario of the scratch dashboard, split by whether a response body is saved. */
async function storedMocks(scenario: string) {
  const files = await scratch.listMocks(scenario);
  const withBody = [];
  for (const file of files) {
    const mock = (await scratch.getMock(file.filename, scenario)).data;
    if (mock.response?.data != null && mock.responsePending !== true) withBody.push({ endpoint: file.endpoint as string, mock });
  }
  return { count: files.length, withBody };
}

test.describe('dashboard GUI from scratch', { tag: '@gui' }, () => {
  test.beforeAll(scratchStack.start);
  test.afterAll(scratchStack.stop);

  // Same order as the other GUI clips: the dashboard opens first, then the app signs in next to it.
  test.beforeEach(async ({ page, dash }) => {
    await expect(dash.page.getByRole('heading', { name: 'Total Files' })).toBeVisible();
    await openAppFromLogin(page);
  });

  test('from scratch: mock only the Open-Meteo endpoint, then create and switch scenarios', documented(
    'Starting from an empty dashboard with nothing stored, only the Open-Meteo forecast is turned into a mock through the UI (Hops page); the app then follows edited values in two scenarios created in the UI.',
    [
      [HELPER, `beforeAll: scripts/scratch-dashboard.sh start (empty branch-build dashboard on ${SCRATCH_DASHBOARD}, fresh sqlite dir); scripts/ww-service.sh wander-api|gateway-api start with MOCKIFYER_DASHBOARD_URL=${SCRATCH_DASHBOARD} WW_RECORD=off (no record env)`],
      [UI, 'Start screen of the empty dashboard: "Temporary (unscoped)" scenario banner, Total Files 0; it waits there while the app signs in'],
      [APP, 'Login screen in a fresh context: type the demo user "wanderer" and the demo password, click Sign in, click the Discover tab'],
      [APP, 'The Temperature tile shows live weather (no lane on this dashboard yet, so strict lane mode passes every call through and stores nothing)'],
      [UI, 'Sidebar Mocks: "No mocks found"'],
      [UI, `Sidebar Network, Client lane filter = ${LANE}: the trace lists "Upstream" GET /discover (wander-api) and "Upstream" GET /v1/forecast (Open-Meteo), both live`],
      [UI, 'Sidebar Hops: "No linked service chains in this scenario yet." (Hops lists stored entries only)'],
      [UI, 'Banner "Switch to default"; sidebar Settings -> Client lanes: type the lane id, Add lane (lane -> default); header shows "Record: On" (the default: request-only placeholders, no bodies)'],
      [APP, 'Refetch Discover: still live weather; the dashboard stores a request-only placeholder (Live, no body) per called endpoint'],
      [UI, 'Header "Record: On" -> "Record: Off": nothing new is stored from now on'],
      [UI, 'Sidebar Hops: the Discover chain starts at the gateway hop GET /api/discover; "Expand nested hops" shows wander-api GET /discover; the Open-Meteo hop is not visible until that hop is expanded too, then GET /v1/forecast (Athens) shows under it with a "Pending" badge (placeholder, no body yet)'],
      [UI, 'Click the Open-Meteo hop -> its mock editor; Request tab -> "Use saved mock", toast: No saved body yet — the next request will capture from live, then this mock will be served.'],
      [APP, 'Refetch Discover: the forecast is captured once and then served from the mock; the tile shows that value'],
      [UI, 'Sidebar Hops, expand GET /api/discover and GET /discover again: GET /v1/forecast now shows "Replay"; GET /discover and the other hops stay "Pending" placeholders'],
      [UI, `Sidebar Network (lane ${LANE}): GET /v1/forecast is served as "Mock", while GET /discover and the other APIs (countries, advice) are still "Upstream" (live)`],
      [UI, 'Sidebar Mocks: Domains tree shows api.open-meteo.com with "1 mocked" and every other host with "0 mocked"'],
      [API, 'Only the Open-Meteo forecast mock has a stored response body; every other entry is a request-only placeholder; the tile shows the stored temperature'],
      [UI, `Settings > Create New Scenario: derive from default, name ${SCENARIO_A}, Create & Switch; Client lanes: lane scenario = ${SCENARIO_A}`],
      [UI, `Sidebar Mocks -> search -> Expand all -> forecast card -> mock editor; Request tab "Use saved mock" (derived scenarios start on live API); Response tab: current.temperature_2m = ${TEMP_A}, Save Changes`],
      [APP, `Refetch until ${TEMP_A}°`],
      [UI, `Settings > Create New Scenario: derive from ${SCENARIO_A}, name ${SCENARIO_B}, Create & Switch; lane scenario = ${SCENARIO_B}; mock editor: "Use saved mock", current.temperature_2m = ${TEMP_B}, Save Changes`],
      [APP, `Refetch until ${TEMP_B}°`],
      [UI, `Client lanes: lane scenario = ${SCENARIO_A}`],
      [APP, `Refetch until ${TEMP_A}°`],
      [UI, `Client lanes: lane scenario = ${SCENARIO_B}`],
      [APP, `Refetch until ${TEMP_B}°`],
      [HELPER, 'afterAll: gateway back to the demo dashboard (as dev:proxy:record starts it), scratch dashboard stopped and its data dir deleted, wander-api pinned to guide-demo-2'],
    ],
  ), async ({ page, dash }) => {
    test.setTimeout(SCRATCH_TIMEOUT_MS);

    // 1. Empty dashboard, everything live, nothing stored.
    await expect(dash.page.getByText(/Unscoped traffic is stored temporarily/)).toBeVisible();
    await expect(dash.recordSwitch()).toBeVisible();
    await appShowsSomeTemperature(page);
    await dash.expectNoMocks();
    await dash.openNetworkForLane();
    await expect(dash.networkHop('Upstream', 'GET /v1/forecast').first()).toBeVisible({ timeout: 20_000 });
    await expect(dash.networkHop('Upstream', 'GET /discover').first()).toBeVisible();
    await expect(dash.networkHop('Mock', 'GET /v1/forecast')).toHaveCount(0);
    await dash.expectNoHops();
    expect((await storedMocks('default')).count).toBe(0);

    // 2. A lane for the app, one load with Record On (request-only placeholders), then Record Off.
    await dash.switchToDefaultScenario();
    await dash.openClientLanes();
    await dash.addLane();
    await expect(dash.recordSwitch()).toHaveText('Record: On');
    await appShowsSomeTemperature(page);
    await expect.poll(async () => (await storedMocks('default')).count, { timeout: 20_000 }).toBeGreaterThan(1);
    expect((await storedMocks('default')).withBody).toHaveLength(0);
    await dash.setRecord(false);

    // 3. Hops: expand GET /discover, mock only the Open-Meteo hop.
    await dash.openFromSidebar('Hops');
    const gatewayHop = dash.hopRow(GATEWAY_DISCOVER_HOP);
    const discoverHop = dash.hopRow(DISCOVER_HOP);
    const forecastHop = dash.hopRow(FORECAST_HOP);
    await expect(gatewayHop).toBeVisible();
    await dash.expandHop(gatewayHop);
    await expect(discoverHop).toBeVisible();
    await expect(forecastHop).toBeHidden();
    await dash.expandHop(discoverHop);
    await expect(forecastHop).toBeVisible();
    await expect(forecastHop.getByText('Pending', { exact: true })).toBeVisible();
    await dash.openHop(forecastHop);
    await dash.useSavedMock(CAPTURE_NEXT_TOAST, ATHENS_ENDPOINT_PREFIX);

    // 4. One refetch captures the forecast; from then on it is served from the mock, the rest stays live.
    await appShowsSomeTemperature(page);
    await expect.poll(async () => (await storedMocks('default')).withBody.length, { timeout: 20_000 }).toBe(1);
    const { withBody, count } = await storedMocks('default');
    expect(withBody[0].endpoint.startsWith(ATHENS_ENDPOINT_PREFIX)).toBe(true);
    expect(count).toBeGreaterThan(1);
    await expectTemperatureAfterRefetch(page, withBody[0].mock.response.data.current.temperature_2m);
    expect(await shownTemperature(page)).toBe(withBody[0].mock.response.data.current.temperature_2m);
    await dash.openFromSidebar('Hops');
    await dash.expandHop(gatewayHop);
    await dash.expandHop(discoverHop);
    await expect(forecastHop.getByText('Replay', { exact: true })).toBeVisible();
    await expect(discoverHop.getByText('Pending', { exact: true })).toBeVisible();
    await dash.openNetworkForLane();
    await expect(dash.networkHop('Mock', 'GET /v1/forecast').first()).toBeVisible({ timeout: 20_000 });
    await expect(dash.networkHop('Upstream', 'GET /discover').first()).toBeVisible();
    await expect(dash.networkHop('Upstream', 'GET /countries/name/greece').first()).toBeVisible();
    await dash.openFromSidebar('Mocks');
    await expect(dash.domainFolder('api.open-meteo.com')).toContainText('1 mocked');
    await expect(dash.domainFolder('www.apicountries.com')).toContainText('0 mocked');
    await expect(dash.domainFolder('api.adviceslip.com')).toContainText('0 mocked');

    // 5. Scenario A from default, its own value.
    await dash.createScenario(SCENARIO_A, 'default');
    await dash.openClientLanes();
    await dash.setLaneScenario(SCENARIO_A);
    await dash.openAthensMock();
    await dash.useSavedMock(SERVE_SAVED_TOAST);
    await dash.saveResponseNumber('current', 'temperature_2m', TEMP_A);
    await appShows(page, TEMP_A);

    // 6. Scenario B from A, its own value.
    await dash.createScenario(SCENARIO_B, SCENARIO_A);
    await dash.openClientLanes();
    await dash.setLaneScenario(SCENARIO_B);
    await dash.openAthensMock();
    await dash.useSavedMock(SERVE_SAVED_TOAST);
    await dash.saveResponseNumber('current', 'temperature_2m', TEMP_B);
    await appShows(page, TEMP_B);

    // 7. Switching the lane between the two scenarios moves the app each time.
    await dash.openClientLanes();
    await dash.setLaneScenario(SCENARIO_A);
    await appShows(page, TEMP_A);
    await dash.setLaneScenario(SCENARIO_B);
    await appShows(page, TEMP_B);
  });
});
