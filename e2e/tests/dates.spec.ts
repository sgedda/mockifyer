import { test, expect } from '@playwright/test';
import { dashboard } from '../lib/dashboard';
import { LANE } from '../lib/env';

// Date overrides are checked at the API level only: the WanderWeird app computes "in N days"
// from the browser clock, so there is no app-visible value to assert end to end.
const SCENARIO = 'rainy-weekend';
const FIXED = '2030-01-15T12:00:00.000Z';

test.describe('dates: overrides', () => {
  let before: any;
  let laneBefore: string | null;
  test.beforeAll(async () => {
    before = (await dashboard.dateConfig(SCENARIO)).dateManipulation ?? {};
    laneBefore = (await dashboard.lane(LANE))?.fixedDate ?? null;
  });
  test.afterAll(async () => {
    await dashboard.setDateConfig({ scenario: SCENARIO, fixedDate: before.fixedDate ?? null, offset: before.offset ?? null, timezone: before.timezone ?? null });
    await dashboard.setLaneDate(LANE, laneBefore);
  });

  test('scenario fixedDate is stored and returned as the current date', async () => {
    await dashboard.setDateConfig({ scenario: SCENARIO, fixedDate: FIXED });
    const cfg = await dashboard.dateConfig(SCENARIO);
    expect(cfg.dateManipulation.fixedDate).toBe(FIXED);
    expect(new Date(cfg.currentDate).toISOString()).toBe(FIXED);
  });

  test('invalid fixedDate is rejected with 400', async () => {
    const r = await dashboard.call('POST', '/date-config', { scenario: SCENARIO, fixedDate: 'not-a-date' });
    expect(r.status).toBe(400);
  });

  test('clearing the scenario date removes the override', async () => {
    await dashboard.setDateConfig({ scenario: SCENARIO, fixedDate: null });
    expect((await dashboard.dateConfig(SCENARIO)).dateManipulation.fixedDate ?? null).toBeNull();
  });

  test('client lane fixedDate can be set and cleared', async () => {
    await dashboard.setLaneDate(LANE, FIXED);
    expect(JSON.stringify(await dashboard.lane(LANE))).toContain(FIXED);
    await dashboard.setLaneDate(LANE, null);
    expect(JSON.stringify(await dashboard.lane(LANE))).not.toContain(FIXED);
  });
});
