import { test, expect } from '@playwright/test';
import { dashboard } from '../lib/dashboard';
import { BASE_SCENARIO, LANE, ATHENS_ENDPOINT_PREFIX, DASHBOARD } from '../lib/env';

// Read-only checks of the dashboard API and UI. Nothing to restore.
test.describe('dashboard: listing', () => {
  test('lists the demo scenarios with the base scenario active', async () => {
    const cfg = await dashboard.scenarioConfig();
    expect(cfg.success).toBe(true);
    expect(cfg.currentScenario).toBe(BASE_SCENARIO);
    expect(cfg.scenarios).toEqual(expect.arrayContaining([BASE_SCENARIO, 'heatwave', 'rainy-weekend']));
  });

  test('lists mocks, including the Open-Meteo Athens forecast, and returns its body', async () => {
    const files = await dashboard.listMocks(BASE_SCENARIO);
    expect(files.length).toBeGreaterThan(0);
    const athens = files.find((f: any) => f.endpoint.startsWith(ATHENS_ENDPOINT_PREFIX));
    expect(athens, 'Athens forecast mock').toBeTruthy();
    const mock = await dashboard.getMock(athens.filename, BASE_SCENARIO);
    expect(mock.data.response.data.current).toHaveProperty('temperature_2m');
  });

  test('lists the demo client lane', async () => {
    const lanes = await dashboard.lanes();
    expect(lanes.enabled).toBe(true);
    expect((await dashboard.lane(LANE))?.scenario).toBe(BASE_SCENARIO);
  });

  test('Settings UI shows the client lane with a scenario select', async ({ page }) => {
    await page.goto(`${DASHBOARD}/settings`);
    const card = page.locator('div').filter({ hasText: LANE }).filter({ has: page.locator('select') }).last();
    await expect(card.locator('select').first()).toHaveValue(BASE_SCENARIO, { timeout: 30_000 });
  });

  test('rejects a mock PUT with no updatable fields (400)', async () => {
    const file = await dashboard.athensMock(BASE_SCENARIO);
    const r = await dashboard.putMock(file, { nothing: true }, BASE_SCENARIO);
    expect(r.status).toBe(400);
  });
});
