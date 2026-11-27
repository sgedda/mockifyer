import { expect } from '@playwright/test';
import { test, holdForClip, openAppFromLogin, PRESENTATION } from '../lib/gui';
import { ACTOR, documented, type Actor } from '../lib/docs';
import { dashboard } from '../lib/dashboard';
import { wander, waitForGateway, followLaneAndWait, pinToBaseAndWait } from '../lib/stack';
import {
  expectTemperature,
  expectTemperatureAfterRefetch,
  openDiscover,
  temperatureTile,
} from '../lib/app';
import {
  BASE_SCENARIO,
  EXPECTED_TEMP,
  LANE,
  WANDER_DISCOVER_URL,
} from '../lib/env';

/**
 * Presentation recording: wander-api is stopped while Discover still renders from saved hop mocks.
 * Left = WanderWeird app still showing Atlantis temperature. Right = dashboard Network with the
 * gateway → wander-api hop as Mock (not Upstream), so viewers see offline replay in action.
 *
 * Complements `offline.spec.ts` (API-level checks that leave a blank Chromium frame when filmed).
 */
const BASE_TEMP = EXPECTED_TEMP[BASE_SCENARIO];
const WANDER_DISCOVER = 'http://127.0.0.1:4203/discover';
const { dashboardUi: UI, app: APP, dashboardApi: API, helper: HELPER } = ACTOR;
const OFFLINE_TIMEOUT_MS = PRESENTATION ? 300_000 : 120_000;

/** Record-on-miss placeholders for the gateway → wander-api /discover hops. */
async function wanderDiscoverHopMocks(): Promise<Array<{ filename: string; endpoint: string }>> {
  const files = await dashboard.listMocks(BASE_SCENARIO);
  return files.filter((f: { endpoint?: string }) => f.endpoint?.startsWith(WANDER_DISCOVER));
}

const NAV_NETWORK: [Actor, string] = [
  UI,
  `Navigate: sidebar Network -> Client lane filter = ${LANE}`,
];

test.describe('offline replay GUI: wander-api down', { tag: '@gui' }, () => {
  const savedHops: Array<{ filename: string; endpoint: string }> = [];

  test.beforeAll(async () => {
    await followLaneAndWait();
  });

  test.afterEach(async () => {
    // Bring wander-api back before deleting hop mocks so the shared stack is usable again.
    wander.followLane();
    await waitForGateway();
    for (const hop of savedHops.splice(0)) {
      await dashboard.deleteMock(hop.filename, BASE_SCENARIO);
    }
    await dashboard.restoreDemoScenarios();
  });

  test.afterAll(pinToBaseAndWait);

  test.beforeEach(async ({ page, dash }) => {
    await expect(dash.page.getByRole('heading', { name: 'Total Files' })).toBeVisible();
    await openAppFromLogin(page);
    await expectTemperature(page, BASE_TEMP);
  });

  test(
    'Discover still renders from hop mocks while wander-api is stopped',
    documented(
      'With wander-api stopped, the app still shows Atlantis from saved gateway → wander-api hop mocks, and the Network trace marks that hop as Mock.',
      [
        [HELPER, 'beforeAll: restart wander-api unpinned (scripts/wander.sh start) so it follows the client lane'],
        [UI, 'Start screen: the dashboard opens at / (Statistics) while the app signs in'],
        [APP, 'Login → Discover: Atlantis Temperature tile shows the base mock value'],
        [API, 'PUT each gateway → wander-api /discover hop mock to stored replay with a live response body'],
        NAV_NETWORK,
        [UI, 'Clear network log for the demo lane'],
        [HELPER, 'Stop wander-api (scripts/wander.sh stop)'],
        [APP, 'Fresh Discover load still shows the base temperature from hop mocks'],
        [UI, 'Trace: expand GET /api/discover → GET /discover; the wander hop is Mock (not Upstream)'],
        [UI, `Details: Source Mock, URL ${WANDER_DISCOVER_URL}, Status 200`],
        [HELPER, 'afterEach: restart wander-api, delete the filled-in hop mocks, restore demo scenarios'],
      ],
    ),
    async ({ page, dash }) => {
      test.setTimeout(OFFLINE_TIMEOUT_MS);

      const hops = await wanderDiscoverHopMocks();
      expect(hops.length, 'gateway → wander-api /discover hop mocks').toBeGreaterThan(0);
      savedHops.push(...hops);

      for (const hop of hops) {
        const live = await fetch(hop.endpoint, { headers: { 'x-mockifyer-client-id': LANE } });
        expect(live.status, `live ${hop.endpoint}`).toBe(200);
        const saved = await dashboard.putMock(
          hop.filename,
          {
            responseData: await live.json(),
            statusOverride: 200,
            replayMode: 'stored',
            alwaysUseRealApi: false,
          },
          BASE_SCENARIO,
        );
        expect(saved.status, `save ${hop.filename}`).toBe(200);
      }

      await dash.openNetworkForLane();
      await dash.clearNetworkLog();

      wander.stop();

      // Fresh navigation (session may still be signed in). A failed in-place refetch would keep
      // the previous render and hide a mock miss — same pattern as offline.spec.ts.
      await openDiscover(page);
      await expectTemperature(page, BASE_TEMP);
      await holdForClip(temperatureTile(page));

      await expectTemperatureAfterRefetch(page, BASE_TEMP);
      await holdForClip(temperatureTile(page));

      await expect(dash.networkHop('Mock', 'GET /discover').first()).toBeVisible({ timeout: 20_000 });
      await dash.pauseLiveTraffic();
      const [, wanderRow] = await dash.expandTrace(
        dash.networkHop('Upstream', 'GET /api/discover').first(),
        'GET /discover',
      );
      await expect(wanderRow).toContainText('Mock');
      await dash.selectHop(wanderRow, WANDER_DISCOVER_URL);
      await dash.expectDetail('Source', 'Mock');
      await dash.expectDetail('Status', '200');
      await holdForClip(temperatureTile(page));
    },
  );
});
