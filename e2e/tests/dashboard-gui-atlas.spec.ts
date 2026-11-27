import { expect } from '@playwright/test';
import { test, holdForClip, openAppFromLogin, presentChange, presentationPause, PRESENTATION } from '../lib/gui';
import { ACTOR, documented } from '../lib/docs';
import { followLaneAndWait, pinToBaseAndWait } from '../lib/stack';
import { expectTemperature, temperatureTile } from '../lib/app';
import { EXPECTED_TEMP, BASE_SCENARIO, PRESENTATION_HOLD_MS, PRESENTATION_NAV_HOLD_MS } from '../lib/env';
import { generateAtlasReport } from '../lib/atlas-report';

/**
 * Presentation recording: interactive Atlas architecture map.
 * Left pane = WanderWeird Discover (the traffic source). Right pane = generated Atlas HTML
 * (Architecture view → system diagram → endpoint row → hop/value inspection detail).
 *
 * Atlas HTML is normally only written in global teardown; this test generates it mid-run from
 * the session's network events so Playwright can film the interactive page.
 */
const BASE_TEMP = EXPECTED_TEMP[BASE_SCENARIO];
const { dashboardUi: UI, app: APP, helper: HELPER } = ACTOR;
/** Atlas HTML generation + Architecture walkthrough; match the tracing GUI budget when not presenting. */
const ATLAS_TIMEOUT_MS = PRESENTATION ? 300_000 : 180_000;

/** Index of the first endpoint inventory row that saw traffic (`data-calls` > 0), else 0. */
async function observedEndpointIndex(page: import('@playwright/test').Page): Promise<number> {
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
      'After an app Discover load, the generated Atlas Architecture page shows the system diagram; clicking an observed endpoint opens the Endpoint Detail inspection pane with request/response context.',
      [
        [HELPER, 'beforeAll: restart wander-api unpinned so Discover traffic is recorded'],
        [UI, 'Start screen: dashboard opens at / (Statistics) while the app signs in'],
        [APP, 'Login → Discover: Atlantis Temperature tile shows the base mock value'],
        [HELPER, 'Generate interactive Atlas HTML from dashboard network events into e2e/atlas-report/'],
        [UI, 'Navigate the dashboard pane to the generated Atlas index (Architecture view)'],
        [UI, 'Scroll to System Diagram; outline Open diagram; open the SVG diagram popup briefly'],
        [UI, 'Scroll to Endpoint inventory; click an observed endpoint row'],
        [UI, 'Architecture detail pane shows Endpoint Detail (host, method, path, last observed / body)'],
        [UI, 'Switch to Timeline; select a hop so the detail pane shows hop inspection'],
        [HELPER, 'afterAll: pin wander-api back to the base scenario'],
      ],
    ),
    async ({ page, dash }) => {
      test.setTimeout(ATLAS_TIMEOUT_MS);

      await expectTemperature(page, BASE_TEMP);

      const atlas = await generateAtlasReport();
      expect(atlas.eventCount, 'network events for Atlas').toBeGreaterThan(0);

      await dash.page.goto(atlas.indexUrl);
      await expect(dash.page.locator('#atlas-app')).toBeVisible({ timeout: 15_000 });
      await expect(dash.page.getByRole('button', { name: 'Architecture', exact: true })).toHaveClass(/active/);
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

      // Prefer the top tab (Architecture / Timeline / Data); the Architecture panel also has a nav hint.
      const timeline = dash.page.locator('.tabs').getByRole('button', { name: 'Timeline', exact: true });
      await presentChange(timeline, async () => {
        await timeline.click();
        await expect(timeline).toHaveClass(/active/);
      }, PRESENTATION_NAV_HOLD_MS);

      const hopRow = dash.page.locator('[data-select]').first();
      if (await hopRow.count()) {
        await hopRow.scrollIntoViewIfNeeded();
        await presentChange(hopRow, async () => {
          await hopRow.click();
        });
        await expect(detail).toBeVisible();
        await presentationPause(dash.page, PRESENTATION_HOLD_MS);
      }

      await holdForClip(temperatureTile(page));
    },
  );
});
