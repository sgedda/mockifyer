import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { BASE_SCENARIO, DASHBOARD, LANE } from './env';
import { DASHBOARD_VIDEO_ATTACHMENT } from './videos';

/** Desktop size: the dashboard sidebar is only static from the `lg` breakpoint (1024px). */
export const DASHBOARD_VIEWPORT = { width: 1280, height: 800 };
/** Keeps the final state on screen for a moment so each clip ends on the result. */
const FINAL_FRAME_HOLD_MS = 750;
/** Long enough for a viewer to read an intermediate app value in the recording. */
const CHANGE_HOLD_MS = 500;

/** Leave a just-asserted change on screen long enough to be readable in the clip. */
export async function holdForClip(page: Page) {
  await page.waitForTimeout(CHANGE_HOLD_MS);
}

/**
 * `page` is the WanderWeird app (project viewport). `dash` drives the real dashboard UI in its
 * own desktop-sized context, recorded to a separate video that is attached to the test result.
 */
export const test = base.extend<{ dash: DashboardUi }>({
  dash: async ({ browser, page }, use, testInfo) => {
    const context = await browser.newContext({
      baseURL: DASHBOARD,
      viewport: DASHBOARD_VIEWPORT,
      recordVideo: { dir: testInfo.outputPath('dashboard-video'), size: DASHBOARD_VIEWPORT },
    });
    const dashPage = await context.newPage();
    await use(new DashboardUi(dashPage));
    await page.waitForTimeout(FINAL_FRAME_HOLD_MS);
    await context.close();
    const video = dashPage.video();
    if (video) {
      await testInfo.attach(DASHBOARD_VIDEO_ATTACHMENT, { path: await video.path(), contentType: 'video/webm' });
    }
  },
});

/** The dashboard used like a user would: navigation, form fields, buttons and the resulting toasts. */
export class DashboardUi {
  constructor(readonly page: Page) {}

  private async expectToast(text: string) {
    await expect(this.page.getByText(text, { exact: true }).first()).toBeVisible();
  }

  // Mock editor (/mock): Form Editor renders every JSON key and value as an input.
  async openMock(file: string) {
    await this.page.goto(`/mock?file=${encodeURIComponent(file)}&scenario=${encodeURIComponent(BASE_SCENARIO)}`);
    await expect(this.page.getByText('Edit Mock:')).toBeVisible();
  }

  /** Number input for `parent.field` of the stored response body (key inputs carry the key as value). */
  responseNumberField(parent: string, field: string): Locator {
    const parentEntry = this.page.locator(`input[value="${parent}"]`).locator('xpath=../..');
    return parentEntry.locator(`input[value="${field}"]`).locator('xpath=..').locator('input[type="number"]');
  }

  async expectResponseNumber(parent: string, field: string, value: number) {
    const input = this.responseNumberField(parent, field);
    await input.scrollIntoViewIfNeeded();
    await expect(input).toHaveValue(String(value));
  }

  async saveResponseNumber(parent: string, field: string, value: number) {
    const input = this.responseNumberField(parent, field);
    await input.fill(String(value));
    await expect(input).toHaveValue(String(value));
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
    await this.expectToast('Mock updated successfully');
  }

  /** Request tab > Response Simulation > Status Override; saved when the field loses focus. */
  async saveStatusOverride(status: number) {
    await this.page.getByRole('tab', { name: 'Request' }).click();
    const input = this.page.getByLabel('Status Override');
    await input.fill(String(status));
    await input.blur();
    await this.expectToast(`Status override set to ${status}`);
  }

  // Overrides (/overrides): mock-level field overrides, applied at serve time.
  async openOverrides(file: string) {
    await this.page.goto(`/overrides?file=${encodeURIComponent(file)}&scenario=${encodeURIComponent(BASE_SCENARIO)}`);
    await expect(this.page.getByRole('button', { name: 'Save overlays' })).toBeVisible();
    // The detail pane reloads its drafts while the mock lists arrive; wait for that to settle.
    await this.page.waitForLoadState('networkidle');
  }

  async saveFieldOverride(path: string, value: unknown) {
    await this.page.getByRole('button', { name: 'Add field override', exact: true }).click();
    const pathInput = this.page.getByPlaceholder('e.g. bookings.0.status').last();
    const valueInput = this.page.getByPlaceholder('e.g. "CONFIRMED"').last();
    await pathInput.fill(path);
    await valueInput.fill(JSON.stringify(value));
    await expect(pathInput).toHaveValue(path);
    await this.page.getByRole('button', { name: 'Save overlays' }).click();
    await this.expectToast('Overrides saved');
  }

  async openMockFromOverrides() {
    await this.page.getByRole('link', { name: 'Open mock' }).click();
    await expect(this.page.getByText('Edit Mock:')).toBeVisible();
  }

  // Settings > Client lanes
  async openClientLanes() {
    await this.page.goto('/settings#client-lanes');
    await expect(this.page.getByTestId('lane-global-fallback')).toBeVisible();
    // The hash scroll can land early while the cards above are still loading.
    await this.page.locator('#client-lanes').evaluate((card) => card.scrollIntoView({ block: 'start' }));
  }

  laneScenarioSelect(lane = LANE): Locator {
    return this.page.getByLabel(`Scenario for ${lane}`, { exact: true });
  }

  async setLaneScenario(scenario: string, lane = LANE) {
    await this.laneScenarioSelect(lane).selectOption(scenario);
    await this.expectToast(`Lane "${lane}" updated.`);
    await expect(this.laneScenarioSelect(lane)).toHaveValue(scenario);
  }

  async removeLane(lane = LANE) {
    this.page.once('dialog', (dialog) => void dialog.accept());
    await this.page.getByLabel(`Remove lane ${lane}`, { exact: true }).click();
    await this.expectToast(`Lane "${lane}" was removed.`);
    await expect(this.laneScenarioSelect(lane)).toHaveCount(0);
  }

  async setLaneGlobalFallback(enabled: boolean) {
    const checkbox = this.page.getByTestId('lane-global-fallback').getByRole('checkbox');
    if ((await checkbox.isChecked()) === enabled) return;
    // Controlled input: it only flips once PUT /client-lanes/settings/global-fallback has answered.
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: enabled });
  }

  // Header Scenario picker: sets the global scenario.
  async pickHeaderScenario(scenario: string) {
    await this.page.getByTitle('Change the global scenario (clients without a lane)').click();
    await this.page.getByRole('menuitem', { name: scenario, exact: true }).click();
    await this.expectToast(`Switched to "${scenario}"`);
  }

  // Network (/network): live hops for the header scenario, polled every few seconds.
  async openNetworkForLane(lane = LANE) {
    await this.page.getByRole('link', { name: 'Network', exact: true }).click();
    await this.page.getByPlaceholder('Client lane (clientId)').fill(lane);
    await expect(this.page).toHaveURL(new RegExp(`clientId=${lane}`));
  }

  async clearNetworkLog() {
    await this.page.getByRole('button', { name: 'Clear', exact: true }).click();
    await this.expectToast('Network log cleared for this scope');
  }

  /** A hop row in the trace tree: its source badge (Mock, Upstream, ...) and `METHOD path` label. */
  networkHop(source: string, label: string): Locator {
    return this.page
      .getByRole('button')
      .filter({ hasText: label })
      .filter({ has: this.page.getByText(source, { exact: true }) });
  }

  /** Click a hop row; the Details pane then shows its URL. */
  async selectHop(hop: Locator, urlPrefix: string) {
    await hop.click();
    await expect(this.page.getByText(urlPrefix).first()).toBeVisible();
  }
}
