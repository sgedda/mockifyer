import { test, expect } from '@playwright/test';
import { dashboard, gatewayTemp } from '../lib/dashboard';
import { withMcp } from '../lib/mcp';
import { openDiscover, expectTemperature, expectTemperatureAfterRefetch } from '../lib/app';
import { BASE_SCENARIO, EXPECTED_TEMP } from '../lib/env';

// The demo runs wander-api pinned to BASE_SCENARIO, so edits to that scenario reach the app.
const BASE_TEMP = EXPECTED_TEMP[BASE_SCENARIO];

test.describe('overrides: dashboard edits reach the app', () => {
  let file: string;
  let original: any;

  test.beforeAll(async () => {
    file = await dashboard.athensMock(BASE_SCENARIO);
    original = (await dashboard.getMock(file, BASE_SCENARIO)).data.response.data;
  });

  test.afterEach(async () => {
    // Always put the response body back and clear field overrides.
    await dashboard.putMock(file, { responseData: original }, BASE_SCENARIO);
    await dashboard.call('PATCH', `/mocks/${file}/field-overrides?scenario=${BASE_SCENARIO}`, { responseFieldOverrides: null });
    await expect.poll(gatewayTemp, { timeout: 20_000 }).toBe(BASE_TEMP);
  });

  test('responseData edit via PUT /api/mocks shows in the app', async ({ page }) => {
    await openDiscover(page);
    await expectTemperature(page, BASE_TEMP);
    const edited = structuredClone(original);
    edited.current.temperature_2m = 37;
    const r = await dashboard.putMock(file, { responseData: edited }, BASE_SCENARIO);
    expect(r.status).toBe(200);
    await expectTemperatureAfterRefetch(page, 37);
  });

  test('field override via PATCH field-overrides shows in the app, stored body unchanged', async ({ page }) => {
    const r = await dashboard.call('PATCH', `/mocks/${file}/field-overrides?scenario=${BASE_SCENARIO}`, {
      responseFieldOverrides: [{ path: 'current.temperature_2m', value: -999 }],
    });
    expect(r.status).toBe(200);
    const fo = await dashboard.getFieldOverrides(file, BASE_SCENARIO);
    expect(JSON.stringify(fo)).toContain('-999');
    expect((await dashboard.getMock(file, BASE_SCENARIO)).data.response.data.current.temperature_2m).toBe(BASE_TEMP);
    await openDiscover(page);
    await expectTemperatureAfterRefetch(page, -999);
  });

  test('MCP tool mockifyer_set_field_overrides (no agent) changes the app value', async ({ page }) => {
    await withMcp(async (call, tools) => {
      expect(tools).toContain('mockifyer_set_field_overrides');
      const out = await call('mockifyer_set_field_overrides', {
        filename: file, scenario: BASE_SCENARIO, overrides: [{ path: 'current.temperature_2m', value: 23 }],
      });
      expect(out).toContain('success');
    });
    await openDiscover(page);
    await expectTemperatureAfterRefetch(page, 23);
    // read back through MCP as well
    await withMcp(async (call) => {
      expect(await call('mockifyer_get_field_overrides', { filename: file, scenario: BASE_SCENARIO })).toContain('23');
    });
  });
});
