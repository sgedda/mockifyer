import { test, expect } from '@playwright/test';
import { dashboard, gatewayAtlantis, gatewayTemp } from '../lib/dashboard';
import { wander, waitForGateway } from '../lib/stack';
import { openDiscover, expectTemperature, refetchDiscover } from '../lib/app';
import { BASE_SCENARIO, EXPECTED_TEMP } from '../lib/env';

// Stops wander-api (:4203) like the guide's offline-set.sh, then always restarts it pinned and
// restores the replay modes of the two wander /discover mocks to what they were before.
const ENDPOINTS = ['http://127.0.0.1:4203/discover?destinationKey=atlantis', 'http://127.0.0.1:4203/discover'];

test.describe('offline: backend down', () => {
  let files: string[] = [];
  const originalModes = new Map<string, string | undefined>();

  test.beforeAll(async () => {
    const all = await dashboard.listMocks(BASE_SCENARIO);
    files = ENDPOINTS.map((ep) => all.find((f: any) => f.endpoint === ep)?.filename).filter(Boolean);
    expect(files.length).toBe(2);
    for (const f of files) originalModes.set(f, (await dashboard.mockMeta(f, BASE_SCENARIO)).replayMode);
  });

  test.afterEach(async () => {
    wander.pin(BASE_SCENARIO);
    for (const f of files) {
      await dashboard.putMock(f, { replayMode: originalModes.get(f) ?? 'passthrough' }, BASE_SCENARIO);
    }
    await waitForGateway();
    await expect.poll(gatewayTemp, { timeout: 30_000 }).toBe(EXPECTED_TEMP[BASE_SCENARIO]);
  });

  test('app keeps rendering Discover from saved mocks when wander-api is down', async ({ page }) => {
    // record fresh bodies ("refresh-next"), exactly like offline-set.sh
    for (const f of files) await dashboard.putMock(f, { replayMode: 'refresh-next' }, BASE_SCENARIO);
    await gatewayAtlantis();
    await fetch('http://127.0.0.1:4200/api/discover').catch(() => undefined);
    wander.stop();
    const r = await gatewayAtlantis();
    expect(r.status).toBe(200);
    expect(r.json.weather.current.temperature_2m).toBe(EXPECTED_TEMP[BASE_SCENARIO]);
    await openDiscover(page);
    await expectTemperature(page, EXPECTED_TEMP[BASE_SCENARIO]);
    await refetchDiscover(page);
    await expectTemperature(page, EXPECTED_TEMP[BASE_SCENARIO]);
  });

  test('gateway answers 5xx JSON (no crash) when wander-api is down and mocks are on live API', async () => {
    for (const f of files) await dashboard.putMock(f, { replayMode: 'passthrough' }, BASE_SCENARIO);
    wander.stop();
    const r = await gatewayAtlantis();
    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(typeof r.json).toBe('object');
    expect(r.json.error).toBeTruthy();
    // the gateway process is still alive and answers again
    const again = await gatewayAtlantis();
    expect(again.status).toBeGreaterThanOrEqual(500);
  });
});
