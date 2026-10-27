import { expect, type Page } from '@playwright/test';
import { test, holdForClip } from '../lib/gui';
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

  test('mock editor: saving a new response body value shows it in the app', async ({ page, dash }) => {
    await dash.openMock(file);
    await dash.expectResponseNumber('current', 'temperature_2m', BASE_TEMP);
    await dash.saveResponseNumber('current', 'temperature_2m', EDITED_TEMP);
    expect(await storedTemp()).toBe(EDITED_TEMP);
    await appShows(page, EDITED_TEMP);
  });

  test('overrides page: a field override shows in the app while the stored body keeps its value', async ({ page, dash }) => {
    await dash.openOverrides(file);
    await dash.saveFieldOverride('current.temperature_2m', OVERRIDE_TEMP);
    await appShows(page, OVERRIDE_TEMP);
    await dash.openMockFromOverrides();
    await dash.expectResponseNumber('current', 'temperature_2m', BASE_TEMP);
    expect(await storedTemp()).toBe(BASE_TEMP);
    expect(JSON.stringify(await dashboard.getFieldOverrides(file, BASE_SCENARIO))).toContain(String(OVERRIDE_TEMP));
  });

  test('mock editor: a 503 status override makes wander-api fall back to its improvised weather', async ({ page, dash }) => {
    await dash.openMock(file);
    await dash.saveStatusOverride(UPSTREAM_ERROR_STATUS);
    await appShows(page, WANDER_FALLBACK_TEMP);
    expect((await storedMock()).statusOverride).toBe(UPSTREAM_ERROR_STATUS);
  });

  test('Settings client lane: heatwave 44 -> rainy-weekend 11 -> base 99 in the app', async ({ page, dash }) => {
    await dash.openClientLanes();
    for (const scenario of ['heatwave', 'rainy-weekend', BASE_SCENARIO]) {
      await dash.setLaneScenario(scenario);
      await appShows(page, EXPECTED_TEMP[scenario]);
    }
  });

  test('header Scenario picker: strict lane default ignores it, the lane global fallback moves the app to heatwave 44', async ({ page, dash }) => {
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

  test('Network view: an app load shows the Open-Meteo mock hit and the wander-api hop', async ({ page, dash }) => {
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
