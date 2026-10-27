import { expect, type Page } from '@playwright/test';
import { test, holdForClip } from '../lib/gui';
import { ACTOR, documented, type Actor } from '../lib/docs';
import { dashboard, gatewayTemp } from '../lib/dashboard';
import { followLaneAndWait, pinToBaseAndWait } from '../lib/stack';
import {
  openDiscover,
  expectTemperature,
  expectTemperatureAfterRefetch,
  expectTemperatureOtherThanAfterRefetch,
} from '../lib/app';
import {
  ATHENS_ENDPOINT_PREFIX,
  BASE_SCENARIO,
  EXPECTED_TEMP,
  WANDER_DISCOVER_URL,
  WANDER_FALLBACK_TEMP,
} from '../lib/env';

// Each test changes something in the real dashboard UI (`dash`, desktop context) and then asserts the
// new value on screen in the app (`page`). Both pages are recorded; CI puts the two videos side by side.
// wander-api follows the client lane for this file, so lane and global switches reach the app.
const BASE_TEMP = EXPECTED_TEMP[BASE_SCENARIO];
const EDITED_TEMP = 37;
const OVERRIDE_TEMP = 61;
const UPSTREAM_ERROR_STATUS = 503;

const { dashboardUi: UI, app: APP, dashboardApi: API, helper: HELPER } = ACTOR;

/** Steps every GUI test shares around its own: the app on the base value first, state restored after. */
function gui(asserts: string, steps: Array<[Actor, string]>) {
  return documented(asserts, [
    [HELPER, 'beforeAll: restart wander-api unpinned (scripts/wander.sh start) so it follows the client lane'],
    [APP, `Open Discover, sign in as wanderer: the Atlantis Temperature tile shows ${BASE_TEMP}° (Open-Meteo mock, scenario ${BASE_SCENARIO})`],
    ...steps,
    [HELPER, 'afterEach: restore the Athens body, status and field overrides, lane, global scenario and lane global fallback (dashboard API)'],
  ]);
}

/** Re-open Discover until the app shows n, then keep it on screen for the clip. */
async function appShows(page: Page, n: number) {
  await expectTemperatureAfterRefetch(page, n);
  await holdForClip(page);
}

test.describe('dashboard GUI drives the app', { tag: '@gui' }, () => {
  let file: string;
  let original: any;

  test.beforeAll(async () => {
    file = await dashboard.athensMock(BASE_SCENARIO);
    original = (await dashboard.getMock(file, BASE_SCENARIO)).data.response.data;
    await followLaneAndWait();
  });
  test.afterEach(async () => {
    await dashboard.putMock(file, { responseData: original, statusOverride: null }, BASE_SCENARIO);
    await dashboard.clearFieldOverrides(file, BASE_SCENARIO);
    await dashboard.restoreDemoScenarios();
    await expect.poll(gatewayTemp, { timeout: 20_000 }).toBe(BASE_TEMP);
  });
  test.afterAll(pinToBaseAndWait);

  test.beforeEach(async ({ page }) => {
    await openDiscover(page);
    await expectTemperature(page, BASE_TEMP);
  });

  const storedMock = async () => (await dashboard.getMock(file, BASE_SCENARIO)).data;
  const storedTemp = async () => (await storedMock()).response.data.current.temperature_2m;

  test('mock editor: saving a new response body value shows it in the app', gui(
    'A response body edit saved in the mock editor is what the app shows after a refetch, and it is stored.',
    [
      [UI, 'Mocks editor (/mock?file=<Athens forecast>): Form Editor shows current.temperature_2m = 99'],
      [UI, 'Set current.temperature_2m to 37, click Save Changes, toast: Mock updated successfully'],
      [API, 'GET /api/mocks/<file>: stored current.temperature_2m is 37'],
      [APP, 'Trips -> Discover (refetch) until the Temperature tile shows 37°'],
    ],
  ), async ({ page, dash }) => {
    await dash.openMock(file);
    await dash.expectResponseNumber('current', 'temperature_2m', BASE_TEMP);
    await dash.saveResponseNumber('current', 'temperature_2m', EDITED_TEMP);
    expect(await storedTemp()).toBe(EDITED_TEMP);
    await appShows(page, EDITED_TEMP);
  });

  test('overrides page: a field override shows in the app while the stored body keeps its value', gui(
    'A field override saved on the Overrides page changes the served value only; the stored body keeps 99.',
    [
      [UI, 'Overrides (/overrides?file=<Athens forecast>): Add field override, path current.temperature_2m, value 61, Save overlays, toast: Overrides saved'],
      [APP, 'Refetch until the Temperature tile shows 61°'],
      [UI, 'Open mock: the Form Editor still shows the stored current.temperature_2m = 99'],
      [API, 'Stored body is 99 and GET .../field-overrides contains 61'],
    ],
  ), async ({ page, dash }) => {
    await dash.openOverrides(file);
    await dash.saveFieldOverride('current.temperature_2m', OVERRIDE_TEMP);
    await appShows(page, OVERRIDE_TEMP);
    await dash.openMockFromOverrides();
    await dash.expectResponseNumber('current', 'temperature_2m', BASE_TEMP);
    expect(await storedTemp()).toBe(BASE_TEMP);
    expect(JSON.stringify(await dashboard.getFieldOverrides(file, BASE_SCENARIO))).toContain(String(OVERRIDE_TEMP));
  });

  test('mock editor: a 503 status override makes wander-api fall back to its improvised weather', gui(
    'A status override set in the mock editor is served through the proxy: wander-api sees a 503 from Open-Meteo and the app shows its fallback weather.',
    [
      [UI, 'Mocks editor, Request tab, Response Simulation > Status Override = 503 (saved on blur), toast: Status override set to 503'],
      [APP, `Refetch until the Temperature tile shows ${WANDER_FALLBACK_TEMP}° (wander-api fallback, wind 9)`],
      [API, 'Stored statusOverride is 503'],
    ],
  ), async ({ page, dash }) => {
    await dash.openMock(file);
    await dash.saveStatusOverride(UPSTREAM_ERROR_STATUS);
    await appShows(page, WANDER_FALLBACK_TEMP);
    expect((await storedMock()).statusOverride).toBe(UPSTREAM_ERROR_STATUS);
  });

  test('Settings client lane: heatwave 44 -> rainy-weekend 11 -> base 99 in the app', gui(
    'Switching the demo client lane scenario in Settings moves the app between the scenario values.',
    [
      [UI, 'Settings > Client lanes: "Scenario for wanderweird-demo" select = heatwave, toast: Lane "wanderweird-demo" updated.'],
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

  test('header Scenario picker: strict lane default ignores it, the lane global fallback moves the app to heatwave 44', gui(
    'The header picker sets the global scenario; in strict lane mode (#484) a client with a clientId but no lane does not follow it until "Lane global fallback" is on.',
    [
      [UI, 'Settings > Client lanes: Remove lane wanderweird-demo (confirm), toast: Lane "wanderweird-demo" was removed.'],
      [UI, 'Header Scenario picker = heatwave, toast: Switched to "heatwave"'],
      [APP, `Refetch until the tile shows a temperature that is neither ${BASE_TEMP}° nor 44° (live Open-Meteo or the fallback)`],
      [UI, 'Tick "Lane global fallback" (checkbox turns on after the save)'],
      [APP, 'Refetch until 44° (heatwave via global_fallback)'],
      [API, 'GET /api/client-lanes: laneGlobalFallback is true'],
    ],
  ), async ({ page, dash }) => {
    await dash.openClientLanes();
    await dash.removeLane();
    await dash.pickHeaderScenario('heatwave');
    // Strict lane mode (#484): a clientId without a lane gets live API traffic, not the global scenario.
    await expectTemperatureOtherThanAfterRefetch(page, [BASE_TEMP, EXPECTED_TEMP.heatwave]);
    await holdForClip(page);
    await dash.setLaneGlobalFallback(true);
    await appShows(page, EXPECTED_TEMP.heatwave);
    expect((await dashboard.lanes()).laneGlobalFallback).toBe(true);
  });

  test('Network view: an app load shows the Open-Meteo mock hit and the wander-api hop', gui(
    'After an app load the Network trace lists the Open-Meteo mock hit and the wander-api hop for the demo lane.',
    [
      [UI, 'Settings > Client lanes: lane scenario = heatwave'],
      [APP, 'Refetch until 44°'],
      [UI, 'Header Scenario picker = heatwave (the Network view lists the header scenario; the lane still decides what the app gets)'],
      [UI, 'Sidebar > Network, Client lane filter = wanderweird-demo, Clear, toast: Network log cleared for this scope; no Mock GET /v1/forecast row'],
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
});
