import { test, expect } from '@playwright/test';
import { dashboard, gatewayAtlantis } from '../lib/dashboard';
import { wander, waitForGateway } from '../lib/stack';
import { openDiscover, expectTemperature } from '../lib/app';
import { BASE_SCENARIO, EXPECTED_TEMP, LANE } from '../lib/env';
import { documented } from '../lib/docs';

const WANDER_DISCOVER = 'http://127.0.0.1:4203/discover';

/** Record-on-miss placeholders for the gateway -> wander-api /discover hops (one per request hash). */
async function wanderDiscoverHopMocks(): Promise<Array<{ filename: string; endpoint: string }>> {
  const files = await dashboard.listMocks(BASE_SCENARIO);
  return files.filter((f: any) => f.endpoint?.startsWith(WANDER_DISCOVER));
}

// Stops wander-api (:4203) and leaves the gateway running. afterAll restarts wander-api following
// the client lane (how the workflow starts it); the replay test deletes the hop mocks it filled in,
// so record-on-miss recreates the same placeholders on the next request.
test.describe('offline: wander-api down', () => {
  test.afterAll(async () => {
    wander.followLane();
    await waitForGateway();
  });

  test('gateway answers 5xx JSON (no crash) when wander-api is down and the hop is on live API', documented('With wander-api stopped and its hop on live API, the gateway answers a 5xx JSON error and keeps running.'), async () => {
    wander.stop();
    const r = await gatewayAtlantis();
    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(typeof r.json).toBe('object');
    expect(r.json.error).toBeTruthy();
    // the gateway process is still alive and answers again
    const again = await gatewayAtlantis();
    expect(again.status).toBeGreaterThanOrEqual(500);
  });

  test('app keeps rendering Discover from saved hop mocks when wander-api is down', documented('With wander-api stopped, the app still renders Atlantis from the saved gateway -> wander-api hop mocks.'), async ({ page }) => {
    wander.followLane();
    await waitForGateway();
    await openDiscover(page);
    await expectTemperature(page, EXPECTED_TEMP[BASE_SCENARIO]);

    const hops = await wanderDiscoverHopMocks();
    expect(hops.length, 'gateway -> wander-api /discover hop mocks').toBeGreaterThan(0);
    try {
      for (const hop of hops) {
        const live = await fetch(hop.endpoint, { headers: { 'x-mockifyer-client-id': LANE } });
        expect(live.status, `live ${hop.endpoint}`).toBe(200);
        const saved = await dashboard.putMock(
          hop.filename,
          { responseData: await live.json(), statusOverride: 200, replayMode: 'stored', alwaysUseRealApi: false },
          BASE_SCENARIO
        );
        expect(saved.status, `save ${hop.filename}`).toBe(200);
      }

      wander.stop();
      // Fresh load: on a failed refetch Discover keeps the previous render, which would hide a miss.
      await openDiscover(page);
      await expectTemperature(page, EXPECTED_TEMP[BASE_SCENARIO]);
    } finally {
      for (const hop of hops) {
        await dashboard.deleteMock(hop.filename, BASE_SCENARIO);
      }
    }
  });
});
