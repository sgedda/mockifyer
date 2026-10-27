import { test as base, expect, type ElementHandle, type Locator, type Page } from '@playwright/test';
import { BASE_SCENARIO, DASHBOARD, LANE, PRESENTATION_HOLD_MS, presentationOn } from './env';
import { DASHBOARD_VIDEO_ATTACHMENT } from './videos';

/** Desktop size: the dashboard sidebar is only static from the `lg` breakpoint (1024px). */
export const DASHBOARD_VIEWPORT = { width: 1280, height: 800 };
/** Keeps the final state on screen for a moment so each clip ends on the result. */
const FINAL_FRAME_HOLD_MS = 750;
/** Long enough for a viewer to read an intermediate app value in the recording. */
const CHANGE_HOLD_MS = 500;

/** E2E_PRESENTATION=1: slow, readable recordings. Off: every helper below keeps the normal timing. */
export const PRESENTATION = presentationOn();
const PRESENTATION_TYPING_DELAY_MS = 120;
const PRESENTATION_OUTLINE = '3px solid #f59e0b';

/** Presentation mode only: hold the current frame. No-op otherwise. */
export async function presentationPause(page: Page, ms = PRESENTATION_HOLD_MS) {
  if (PRESENTATION) await page.waitForTimeout(ms);
}

/** A handle survives the element leaving the DOM (menu items, removed rows), unlike a locator. */
async function outline(element: ElementHandle, on: boolean) {
  await element.evaluate((el, style) => {
    (el as HTMLElement).style.outline = style;
    (el as HTMLElement).style.outlineOffset = style ? '2px' : '';
  }, on ? PRESENTATION_OUTLINE : '');
}

/**
 * Presentation mode: outline `target`, hold, run `action` (edit, save, toast check), hold while the
 * result and its toast are visible, then drop the outline. Otherwise just `action`.
 */
export async function presentChange(target: Locator, action: () => Promise<unknown>) {
  if (!PRESENTATION) {
    await action();
    return;
  }
  await target.scrollIntoViewIfNeeded();
  const element = await target.elementHandle();
  if (element) await outline(element, true);
  await presentationPause(target.page());
  await action();
  await presentationPause(target.page());
  if (element) {
    await outline(element, false).catch(() => undefined);
    await element.dispose();
  }
}

/** Fill `input`; in presentation mode select its content and type the new value visibly instead. */
async function enterValue(input: Locator, value: string) {
  if (!PRESENTATION) {
    await input.fill(value);
    return;
  }
  await input.press('ControlOrMeta+a');
  await input.pressSequentially(value, { delay: PRESENTATION_TYPING_DELAY_MS });
}

/** Leave a just-asserted app value on screen long enough to read (outlined and longer in presentation mode). */
export async function holdForClip(target: Locator) {
  if (PRESENTATION) {
    await presentChange(target, async () => undefined);
    return;
  }
  await target.page().waitForTimeout(CHANGE_HOLD_MS);
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
    await page.waitForTimeout(PRESENTATION ? PRESENTATION_HOLD_MS : FINAL_FRAME_HOLD_MS);
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
    await presentChange(input, () => enterValue(input, String(value)));
    await expect(input).toHaveValue(String(value));
    const save = this.page.getByRole('button', { name: 'Save Changes' });
    await presentChange(save, async () => {
      await save.click();
      await this.expectToast('Mock updated successfully');
    });
  }

  /** Request tab > Response Simulation > Status Override; saved when the field loses focus. */
  async saveStatusOverride(status: number) {
    await this.page.getByRole('tab', { name: 'Request' }).click();
    const input = this.page.getByLabel('Status Override');
    await presentChange(input, async () => {
      await enterValue(input, String(status));
      await input.blur();
      await this.expectToast(`Status override set to ${status}`);
    });
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
    await presentChange(pathInput, () => enterValue(pathInput, path));
    await presentChange(valueInput, () => enterValue(valueInput, JSON.stringify(value)));
    await expect(pathInput).toHaveValue(path);
    const save = this.page.getByRole('button', { name: 'Save overlays' });
    await presentChange(save, async () => {
      await save.click();
      await this.expectToast('Overrides saved');
    });
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
    const select = this.laneScenarioSelect(lane);
    await presentChange(select, async () => {
      await select.selectOption(scenario);
      await this.expectToast(`Lane "${lane}" updated.`);
      await expect(select).toHaveValue(scenario);
    });
  }

  async removeLane(lane = LANE) {
    this.page.once('dialog', (dialog) => void dialog.accept());
    const remove = this.page.getByLabel(`Remove lane ${lane}`, { exact: true });
    await presentChange(remove, async () => {
      await remove.click();
      await this.expectToast(`Lane "${lane}" was removed.`);
    });
    await expect(this.laneScenarioSelect(lane)).toHaveCount(0);
  }

  async setLaneGlobalFallback(enabled: boolean) {
    const checkbox = this.page.getByTestId('lane-global-fallback').getByRole('checkbox');
    if ((await checkbox.isChecked()) === enabled) return;
    // Controlled input: it only flips once PUT /client-lanes/settings/global-fallback has answered.
    await presentChange(this.page.getByTestId('lane-global-fallback'), async () => {
      await checkbox.click();
      await expect(checkbox).toBeChecked({ checked: enabled });
    });
  }

  // Header Scenario picker: sets the global scenario.
  async pickHeaderScenario(scenario: string) {
    await this.page.getByTitle('Change the global scenario (clients without a lane)').click();
    const item = this.page.getByRole('menuitem', { name: scenario, exact: true });
    await presentChange(item, async () => {
      await item.click();
      await this.expectToast(`Switched to "${scenario}"`);
    });
  }

  // Network (/network): live hops for the header scenario, polled every few seconds.
  async openNetworkForLane(lane = LANE) {
    await this.page.getByRole('link', { name: 'Network', exact: true }).click();
    const laneFilter = this.page.getByPlaceholder('Client lane (clientId)');
    await presentChange(laneFilter, () => enterValue(laneFilter, lane));
    await expect(this.page).toHaveURL(new RegExp(`clientId=${lane}`));
  }

  async clearNetworkLog() {
    const clear = this.page.getByRole('button', { name: 'Clear', exact: true });
    await presentChange(clear, async () => {
      await clear.click();
      await this.expectToast('Network log cleared for this scope');
    });
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
    await presentChange(hop, async () => {
      await hop.click();
      await expect(this.page.getByText(urlPrefix).first()).toBeVisible();
    });
  }
}
