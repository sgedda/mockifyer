import { expect, type Page } from '@playwright/test';
import { test, holdForClip, openAppFromLogin, presentChange, presentationPause, PRESENTATION } from '../lib/gui';
import { ACTOR, documented } from '../lib/docs';
import { dashboard } from '../lib/dashboard';
import { followLaneAndWait, pinToBaseAndWait } from '../lib/stack';
import { expectTemperature, expectTemperatureAfterRefetch, temperatureTile } from '../lib/app';
import { EXPECTED_TEMP, BASE_SCENARIO, PRESENTATION_HOLD_MS, PRESENTATION_NAV_HOLD_MS } from '../lib/env';
import { ATLAS_GUI_EVENT_LIMIT, generateAtlasReport } from '../lib/atlas-report';

/**
 * Presentation recording: interactive Atlas architecture map.
 * Left pane = WanderWeird Discover (the traffic source). Right pane = generated Atlas HTML
 * (Architecture view → system diagram → endpoint row → hop/value inspection detail).
 *
 * Atlas HTML is normally only written in global teardown; this test generates a bounded
 * mid-run report from a fresh Discover session so Playwright can film the interactive page
 * without embedding the full CI network-log backlog (1k+ events → multi‑MB HTML / 90s timeouts).
 */
const BASE_TEMP = EXPECTED_TEMP[BASE_SCENARIO];
const { dashboardUi: UI, app: APP, helper: HELPER, dashboardApi: API } = ACTOR;
/** Fresh session + bounded HTML should finish well under the default 120s; presentation holds need more. */
const ATLAS_TIMEOUT_MS = PRESENTATION ? 240_000 : 120_000;

/** Index of the first endpoint inventory row that saw traffic (`data-calls` > 0), else 0. */
async function observedEndpointIndex(page: Page): Promise<number> {
  return page.locator('.atlas-endpoint-row').first().evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.atlas-endpoint-row'));
    const idx = rows.findIndex((row) => Number(row.getAttribute('data-calls') || '0') > 0);
    return idx >= 0 ? idx : 0;
  });
}

test.describe('Atlas architecture map GUI', { tag: '@gui' }, () => {
  test.beforeAll(followLaneAndWait);
  test.afterAll(pinToBaseAndWait);

  test.beforeEach(async ({ page, dash }) => {
    await expect(dash.page.getByRole('heading', { name: 'Total Files' })).toBeVisible();
    await openAppFromLogin(page);
    await expectTemperature(page, BASE_TEMP);
    await holdForClip(temperatureTile(page));
  });

  test(
    'interactive Atlas architecture map: diagram, endpoint row, and detail pane',
    documented(
      'After a fresh Discover load, a bounded Atlas Architecture page shows the system diagram; clicking an observed endpoint opens the Endpoint Detail pane; Timeline hop select shows hop inspection.',
      [
        [HELPER, 'beforeAll: restart wander-api unpinned so Discover traffic is recorded'],
        [UI, 'Start screen: dashboard opens at / (Statistics) while the app signs in'],
        [APP, 'Login → Discover: Atlantis Temperature tile shows the base mock value'],
        [API, `Clear ${BASE_SCENARIO} network log so Atlas is not built from the CI backlog`],
        [APP, 'Refetch Discover to seed a small, current hop set'],
        [HELPER, `Generate Atlas HTML (limit ${ATLAS_GUI_EVENT_LIMIT}, skip code scan) into e2e/atlas-report/`],
        [UI, 'Navigate the dashboard pane to the generated Atlas index (Architecture view)'],
        [UI, 'Scroll to System Diagram; outline Open diagram; open the SVG diagram popup briefly'],
        [UI, 'Scroll to Endpoint inventory; click an observed endpoint row'],
        [UI, 'Architecture detail pane shows Endpoint Detail (host, method, path, last observed / body)'],
        [UI, 'Switch to Timeline; select a .hop-row so the detail pane shows hop inspection'],
        [HELPER, 'afterAll: pin wander-api back to the base scenario'],
      ],
    ),
    async ({ page, dash }) => {
      test.setTimeout(ATLAS_TIMEOUT_MS);

      // Root cause of CI 90s timeouts: mid-suite Atlas pulled 1k+ events (and rescanned the
      // WanderWeird tree ~9s). Seed a small session instead; teardown still builds the full report.
      await dashboard.clearNetworkEvents(BASE_SCENARIO);
      await expectTemperatureAfterRefetch(page, BASE_TEMP);

      const atlas = await generateAtlasReport({
        scenario: BASE_SCENARIO,
        limit: ATLAS_GUI_EVENT_LIMIT,
        skipCodeScan: true,
      });
      expect(atlas.eventCount, 'network events for Atlas').toBeGreaterThan(0);
      expect(atlas.eventCount, 'bounded Atlas session').toBeLessThanOrEqual(ATLAS_GUI_EVENT_LIMIT);

      await dash.page.goto(atlas.indexUrl);
      await expect(dash.page.locator('#atlas-app')).toBeVisible({ timeout: 15_000 });
      const architectureTab = dash.page.locator('.tabs').getByRole('button', { name: 'Architecture', exact: true });
      await expect(architectureTab).toHaveClass(/active/);
      await expect(dash.page.getByRole('heading', { name: 'System Diagram' })).toBeVisible({ timeout: 15_000 });
      await presentationPause(dash.page, PRESENTATION_HOLD_MS);

      const diagram = dash.page.locator('#arch-system-diagram .atlas-system-diagram');
      await expect(diagram).toBeVisible();
      await diagram.scrollIntoViewIfNeeded();
      // Mild zoom so the architecture map fills the frame in the recording.
      await diagram.evaluate((svg) => {
        (svg as SVGElement).style.transform = 'scale(1.15)';
        (svg as SVGElement).style.transformOrigin = 'center top';
      });
      await presentationPause(dash.page, PRESENTATION_NAV_HOLD_MS);

      const openDiagram = dash.page.getByRole('button', { name: 'Open diagram', exact: true });
      await expect(openDiagram).toBeVisible();
      const popupPromise = dash.page.context().waitForEvent('page');
      await presentChange(openDiagram, async () => {
        await openDiagram.click();
      }, PRESENTATION_NAV_HOLD_MS);
      const diagramPage = await popupPromise;
      await diagramPage.waitForLoadState('domcontentloaded');
      await expect(diagramPage.locator('svg')).toBeVisible({ timeout: 10_000 });
      await presentationPause(diagramPage, PRESENTATION_HOLD_MS);
      await diagramPage.close();

      await expect(dash.page.locator('.atlas-endpoint-row').first()).toBeVisible();
      const rowLocator = dash.page.locator('.atlas-endpoint-row').nth(await observedEndpointIndex(dash.page));
      await rowLocator.scrollIntoViewIfNeeded();
      await presentChange(rowLocator, async () => {
        await rowLocator.click();
      });

      const detail = dash.page.locator('aside.detail, #hop-detail');
      await expect(detail.getByRole('heading', { name: 'Endpoint Detail' })).toBeVisible();
      await expect(detail.getByText('Host', { exact: true })).toBeVisible();
      await expect(detail.getByText('Method', { exact: true })).toBeVisible();
      await presentChange(detail, async () => undefined);

      const timeline = dash.page.locator('.tabs').getByRole('button', { name: 'Timeline', exact: true });
      await presentChange(timeline, async () => {
        await timeline.click();
        await expect(timeline).toHaveClass(/active/);
      }, PRESENTATION_NAV_HOLD_MS);

      // Prefer Trace hop rows — bare [data-select] also matches Architecture/Map affordances.
      const hopRow = dash.page.locator('#timeline-content .hop-row[data-select]').first();
      await expect(hopRow).toBeVisible({ timeout: 15_000 });
      await hopRow.scrollIntoViewIfNeeded();
      await presentChange(hopRow, async () => {
        await hopRow.click({ timeout: 10_000 });
      });
      await expect(detail).toBeVisible();
      await presentationPause(dash.page, PRESENTATION_HOLD_MS);

      await holdForClip(temperatureTile(page));
    },
  );
});
