import { expect, type Page } from '@playwright/test';
import { ACTOR, documented, type Actor } from './docs';
import { Dashboard, dashboard, gatewayTemp } from './dashboard';
import { holdForClip, type DashboardUi } from './gui';
import { expectTemperatureAfterRefetch, expectTemperatureOtherThanAfterRefetch, temperatureTile } from './app';
import {
  ATHENS_ENDPOINT_PREFIX,
  ATHENS_LATITUDE,
  BASE_SCENARIO,
  EXPECTED_TEMP,
  LANE,
  SCRATCH_DASHBOARD,
} from './env';

// What the dashboard GUI tests share across platforms: the app under test behind one interface (the
// Expo web page, or the Android app driven by Maestro), the demo values, how each dashboard page is
// reached, state restore, and the test bodies that run unchanged on both.

/** What a GUI test needs from the app: re-open Discover until the Temperature tile shows a value, then hold it for the clip. */
export interface DemoApp {
  shows(n: number): Promise<void>;
  /** A temperature that is none of `excluded` (e.g. live weather instead of a scenario value). */
  showsOtherThan(excluded: number[]): Promise<void>;
  showsSomeTemperature(): Promise<void>;
}

/** The Expo web app in a browser page. */
export function browserApp(page: Page): DemoApp {
  const hold = () => holdForClip(temperatureTile(page));
  return {
    shows: async (n) => {
      await expectTemperatureAfterRefetch(page, n);
      await hold();
    },
    showsOtherThan: async (excluded) => {
      await expectTemperatureOtherThanAfterRefetch(page, excluded);
      await hold();
    },
    showsSomeTemperature: async () => {
      await expectTemperatureOtherThanAfterRefetch(page);
      await hold();
    },
  };
}

export const BASE_TEMP = EXPECTED_TEMP[BASE_SCENARIO];
export const EDITED_TEMP = 37;
export const OVERRIDE_TEMP = 61;
export const UPSTREAM_ERROR_STATUS = 503;
/** Per-endpoint Response Delay on the Open-Meteo mock: long enough to stand out from a normal ~0.5 s load. */
export const RESPONSE_DELAY_MS = 2_500;

const { dashboardUi: UI, app: APP, dashboardApi: API, helper: HELPER } = ACTOR;

/** How each test reaches its dashboard page from the start screen, by clicks only. */
export const NAV = {
  athensMock: [UI, `Navigate: sidebar Mocks -> search "latitude=${ATHENS_LATITUDE}" + Enter -> Expand all -> click the "forecast" card (Athens Open-Meteo mock) -> mock editor`],
  overrides: [UI, `Navigate: sidebar Overrides -> "Open mock for overlays" picker -> filter "${ATHENS_LATITUDE}" -> pick the Athens forecast -> Edit overlays`],
  clientLanes: [UI, 'Navigate: sidebar Settings -> scroll down to the Client lanes card'],
  network: [UI, `Navigate: sidebar Network -> Client lane filter = ${LANE}`],
} satisfies Record<string, [Actor, string]>;

/**
 * Doc steps of a demo-stack GUI test: `openApp` (how this platform gets the app from its login screen to
 * Discover on the base value) between the shared start and restore steps.
 */
export function demoGuiDoc(openApp: Array<[Actor, string]>) {
  return (asserts: string, steps: Array<[Actor, string]>) =>
    documented(asserts, [
      [HELPER, 'beforeAll: restart wander-api unpinned (scripts/wander.sh start) so it follows the client lane'],
      [UI, 'Start screen: the dashboard opens at / (Statistics), its only direct URL load, and waits there while the app signs in'],
      ...openApp,
      [UI, 'Then the dashboard steps start; every dashboard page is reached by clicks'],
      ...steps,
      [HELPER, 'afterEach: restore the Athens body, status and field overrides, lane, global scenario and lane global fallback (dashboard API)'],
    ]);
}

/** The Athens forecast mock of the base scenario and its stored body, as the demo data has it. */
export interface AthensMock {
  file: string;
  original: unknown;
}

export async function loadAthensMock(): Promise<AthensMock> {
  const file = await dashboard.athensMock(BASE_SCENARIO);
  return { file, original: (await dashboard.getMock(file, BASE_SCENARIO)).data.response.data };
}

export async function storedAthensMock({ file }: AthensMock) {
  return (await dashboard.getMock(file, BASE_SCENARIO)).data;
}

async function storedAthensTemp(athens: AthensMock): Promise<number> {
  return (await storedAthensMock(athens)).response.data.current.temperature_2m;
}

/** afterEach of the demo-stack GUI tests: everything a test may have changed, back to the demo defaults. */
export async function restoreDemo({ file, original }: AthensMock, networkBodyScenarios: string[] = []) {
  await dashboard.putMock(file, { responseData: original, statusOverride: null, responseDelayMs: null }, BASE_SCENARIO);
  await dashboard.clearFieldOverrides(file, BASE_SCENARIO);
  await dashboard.restoreDemoScenarios();
  for (const scenario of networkBodyScenarios) await dashboard.setNetworkBodies(scenario, false);
  await expect.poll(gatewayTemp, { timeout: 20_000 }).toBe(BASE_TEMP);
}

/**
 * Network page (lane filter set): clear the lane's log, run `load` (one app load), wait for its Open-Meteo
 * hop, pause the live list and open the trace GET /api/discover -> GET /discover -> GET /v1/forecast.
 */
export async function traceAppLoad(dash: DashboardUi, load: () => Promise<unknown>) {
  await dash.clearNetworkLog();
  await load();
  await expect(dash.networkHop('Mock', 'GET /v1/forecast').first()).toBeVisible({ timeout: 20_000 });
  await dash.pauseLiveTraffic();
  const [, wanderRow, forecastRow] = await dash.expandTrace(
    dash.networkHop('Upstream', 'GET /api/discover').first(),
    'GET /discover',
    'GET /v1/forecast',
  );
  await expect(wanderRow).toContainText('Upstream');
  await expect(forecastRow).toContainText('Mock');
  return { wanderRow, forecastRow };
}

/**
 * In a fresh trace of `load`: the Open-Meteo hop has `status` and is slower than the delay (`delayed`) or
 * faster, while a sibling hop (countries) stays Upstream, 200 and fast.
 */
export async function expectOpenMeteoHop(
  dash: DashboardUi,
  load: () => Promise<unknown>,
  { status, delayed }: { status: number; delayed: boolean },
) {
  const { wanderRow, forecastRow } = await traceAppLoad(dash, load);
  await dash.selectHop(forecastRow, ATHENS_ENDPOINT_PREFIX);
  await dash.expectDetail('Status', String(status));
  const forecastMs = await dash.detailDurationMs();
  if (delayed) expect(forecastMs).toBeGreaterThanOrEqual(RESPONSE_DELAY_MS);
  else expect(forecastMs).toBeLessThan(RESPONSE_DELAY_MS);
  const countriesRow = dash.traceChild(wanderRow, 'GET /countries/name/greece');
  await dash.selectHop(countriesRow, 'https://www.apicountries.com/countries/name/greece');
  await dash.expectDetail('Source', 'Upstream');
  await dash.expectDetail('Status', '200');
  expect(await dash.detailDurationMs()).toBeLessThan(RESPONSE_DELAY_MS);
}

/** statusOverride / responseDelayMs of every mock except the Athens forecast of the base scenario. */
export async function otherMocksSimulation({ file }: AthensMock) {
  const settings: Record<string, unknown[]> = {};
  const scenarioFiles = [
    ...(await dashboard.listMocks(BASE_SCENARIO)).filter((m) => m.filename !== file).map((m) => [BASE_SCENARIO, m.filename]),
    ['heatwave', await dashboard.athensMock('heatwave')],
  ];
  for (const [scenario, filename] of scenarioFiles) {
    const data = (await dashboard.getMock(filename, scenario)).data;
    settings[`${scenario}/${filename}`] = [data.statusOverride ?? null, data.responseDelayMs ?? null];
  }
  return settings;
}

/**
 * Every mock in `before` still has the settings it had. The services record while the tests run, so mocks
 * recorded in between are left out: they did not exist when the Athens mock was changed.
 */
export async function expectOtherMocksUnchanged(athens: AthensMock, before: Record<string, unknown[]>) {
  const now = await otherMocksSimulation(athens);
  expect(Object.fromEntries(Object.keys(before).map((key) => [key, now[key]]))).toEqual(before);
}

interface DemoGuiContext {
  dash: DashboardUi;
  app: DemoApp;
  athens: AthensMock;
}

interface SharedGuiTest<Ctx> {
  title: string;
  asserts: string;
  steps: Array<[Actor, string]>;
  run(ctx: Ctx): Promise<void>;
}

/** Demo-stack GUI tests that run unchanged on web and Android; each spec declares them with its own app. */
export const DEMO_GUI_TESTS = {
  bodyEdit: {
    title: 'mock editor: saving a new response body value shows it in the app',
    asserts: 'A response body edit saved in the mock editor is what the app shows after a refetch, and it is stored.',
    steps: [
      NAV.athensMock,
      [UI, `Mock editor, Form Editor: current.temperature_2m = ${BASE_TEMP}`],
      [UI, `Set current.temperature_2m to ${EDITED_TEMP}, click Save Changes, toast: Mock updated successfully`],
      [API, `GET /api/mocks/<file>: stored current.temperature_2m is ${EDITED_TEMP}`],
      [APP, `Trips -> Discover (refetch) until the Temperature tile shows ${EDITED_TEMP}°`],
    ],
    async run({ dash, app, athens }) {
      await dash.openAthensMock(athens.file);
      await dash.expectResponseNumber('current', 'temperature_2m', BASE_TEMP);
      await dash.saveResponseNumber('current', 'temperature_2m', EDITED_TEMP);
      expect(await storedAthensTemp(athens)).toBe(EDITED_TEMP);
      await app.shows(EDITED_TEMP);
    },
  },
  fieldOverride: {
    title: 'overrides page: a field override shows in the app while the stored body keeps its value',
    asserts: `A field override saved on the Overrides page changes the served value only; the stored body keeps ${BASE_TEMP}.`,
    steps: [
      NAV.overrides,
      [UI, `Add field override, path current.temperature_2m, value ${OVERRIDE_TEMP}, Save overlays, toast: Overrides saved`],
      [APP, `Refetch until the Temperature tile shows ${OVERRIDE_TEMP}°`],
      [UI, `Click the "Open mock" link: the Form Editor still shows the stored current.temperature_2m = ${BASE_TEMP}`],
      [API, `Stored body is ${BASE_TEMP} and GET .../field-overrides contains ${OVERRIDE_TEMP}`],
    ],
    async run({ dash, app, athens }) {
      await dash.openAthensOverrides(athens.file);
      await dash.saveFieldOverride('current.temperature_2m', OVERRIDE_TEMP);
      await app.shows(OVERRIDE_TEMP);
      await dash.openMockFromOverrides();
      await dash.expectResponseNumber('current', 'temperature_2m', BASE_TEMP);
      expect(await storedAthensTemp(athens)).toBe(BASE_TEMP);
      expect(JSON.stringify(await dashboard.getFieldOverrides(athens.file, BASE_SCENARIO))).toContain(String(OVERRIDE_TEMP));
    },
  },
  headerPicker: {
    title: 'header Scenario picker: strict lane default ignores it, the lane global fallback moves the app to heatwave 44',
    asserts: 'The header picker sets the global scenario; in strict lane mode (#484) a client with a clientId but no lane does not follow it until "Lane global fallback" is on.',
    steps: [
      NAV.clientLanes,
      [UI, `Client lanes: Remove lane ${LANE} (confirm), toast: Lane "${LANE}" was removed.`],
      [UI, 'Header Scenario picker (top right) -> heatwave, toast: Switched to "heatwave"'],
      [APP, `Refetch until the tile shows a temperature that is neither ${BASE_TEMP}° nor ${EXPECTED_TEMP.heatwave}° (live Open-Meteo or the fallback)`],
      [UI, 'Tick "Lane global fallback" (checkbox turns on after the save)'],
      [APP, `Refetch until ${EXPECTED_TEMP.heatwave}° (heatwave via global_fallback)`],
      [API, 'GET /api/client-lanes: laneGlobalFallback is true'],
    ],
    async run({ dash, app }) {
      await dash.openClientLanes();
      await dash.removeLane();
      await dash.pickHeaderScenario('heatwave');
      // Strict lane mode (#484): a clientId without a lane gets live API traffic, not the global scenario.
      await app.showsOtherThan([BASE_TEMP, EXPECTED_TEMP.heatwave]);
      await dash.setLaneGlobalFallback(true);
      await app.shows(EXPECTED_TEMP.heatwave);
      expect((await dashboard.lanes()).laneGlobalFallback).toBe(true);
    },
  },
} satisfies Record<string, SharedGuiTest<DemoGuiContext>>;

// From scratch: an EMPTY dashboard of its own (scripts/scratch-dashboard.sh, :3022) that the gateway and
// wander-api proxy through for this test only, without the record env. Only one endpoint, the Open-Meteo
// forecast, is switched to a stored mock in the UI; everything else stays live.
//
// What the dashboard offers for "mock one endpoint": a per-mock replay mode (mock editor, reached from a hop
// on the Hops page) and a per-path "Record response" rule (Mocks > Domains tree). Both need the endpoint to
// exist as a stored entry first, and the Hops page lists stored entries only. So one app load runs with
// Record On, which stores request-only placeholders (no response body, served Live) for the endpoints the
// app calls; Record is then switched Off and only the forecast is turned into a saved mock.
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

/**
 * Steps of the from-scratch test after `openApp` (this platform's login and Discover steps). The scratch
 * stack scripts are the same on every platform: the app keeps using the demo dashboard, only the gateway
 * and wander-api proxy through the scratch one.
 */
export function fromScratchSteps(openApp: Array<[Actor, string]>): Array<[Actor, string]> {
  return [
    [HELPER, `beforeAll: scripts/scratch-dashboard.sh start (empty branch-build dashboard on ${SCRATCH_DASHBOARD}, fresh sqlite dir); scripts/ww-service.sh wander-api|gateway-api start with MOCKIFYER_DASHBOARD_URL=${SCRATCH_DASHBOARD} WW_RECORD=off (no record env)`],
    [UI, 'Start screen of the empty dashboard: "Temporary (unscoped)" scenario banner, Total Files 0; it waits there while the app signs in'],
    ...openApp,
    [APP, 'The Temperature tile shows live weather (no lane on this dashboard yet, so strict lane mode passes every call through and stores nothing)'],
    [UI, 'Sidebar Mocks: "No mocks found"'],
    [UI, `Sidebar Network, Client lane filter = ${LANE}: the trace lists "Upstream" GET /discover (wander-api) and "Upstream" GET /v1/forecast (Open-Meteo), both live`],
    [UI, 'Sidebar Hops: "No linked service chains in this scenario yet." (Hops lists stored entries only)'],
    [UI, 'Banner "Switch to default"; sidebar Settings -> Client lanes: type the lane id, Add lane (lane -> default); header shows "Record: On" (the default: request-only placeholders, no bodies)'],
    [APP, 'Refetch Discover: still live weather; the dashboard stores a request-only placeholder (Live, no body) per called endpoint'],
    [UI, 'Header "Record: On" -> "Record: Off": nothing new is stored from now on'],
    [UI, 'Sidebar Hops: the Discover chain starts at the gateway hop GET /api/discover; "Expand nested hops" shows wander-api GET /discover; the Open-Meteo hop is not visible until that hop is expanded too, then GET /v1/forecast (Athens) shows under it with a "Pending" badge (placeholder, no body yet)'],
    [UI, `Click the Open-Meteo hop -> its mock editor; Request tab -> "Use saved mock", toast: ${CAPTURE_NEXT_TOAST}`],
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
  ];
}

export const FROM_SCRATCH_TEST = {
  title: 'from scratch: mock only the Open-Meteo endpoint, then create and switch scenarios',
  asserts: 'Starting from an empty dashboard with nothing stored, only the Open-Meteo forecast is turned into a mock through the UI (Hops page); the app then follows edited values in two scenarios created in the UI.',
  async run({ dash, app }: Omit<DemoGuiContext, 'athens'>) {
    // 1. Empty dashboard, everything live, nothing stored.
    await expect(dash.page.getByText(/Unscoped traffic is stored temporarily/)).toBeVisible();
    await expect(dash.recordSwitch()).toBeVisible();
    await app.showsSomeTemperature();
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
    await app.showsSomeTemperature();
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
    await app.showsSomeTemperature();
    await expect.poll(async () => (await storedMocks('default')).withBody.length, { timeout: 20_000 }).toBe(1);
    const { withBody, count } = await storedMocks('default');
    expect(withBody[0].endpoint.startsWith(ATHENS_ENDPOINT_PREFIX)).toBe(true);
    expect(count).toBeGreaterThan(1);
    await app.shows(withBody[0].mock.response.data.current.temperature_2m);
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
    await app.shows(TEMP_A);

    // 6. Scenario B from A, its own value.
    await dash.createScenario(SCENARIO_B, SCENARIO_A);
    await dash.openClientLanes();
    await dash.setLaneScenario(SCENARIO_B);
    await dash.openAthensMock();
    await dash.useSavedMock(SERVE_SAVED_TOAST);
    await dash.saveResponseNumber('current', 'temperature_2m', TEMP_B);
    await app.shows(TEMP_B);

    // 7. Switching the lane between the two scenarios moves the app each time.
    await dash.openClientLanes();
    await dash.setLaneScenario(SCENARIO_A);
    await app.shows(TEMP_A);
    await dash.setLaneScenario(SCENARIO_B);
    await app.shows(TEMP_B);
  },
};
