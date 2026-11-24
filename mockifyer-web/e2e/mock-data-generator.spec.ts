import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Mock Data Generator playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tools/mock-data-generator');
  });

  test('renders the playground page', async ({ page }) => {
    await expect(page.getByTestId('mock-data-generator-page')).toBeVisible();
    await expect(page.getByTestId('playground-intro')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Mock data generator/i })).toBeVisible();
    await expect(
      page.getByText(/Paste one API response, get realistic data and edge cases/i)
    ).toBeVisible();
    await expect(page.getByTestId('privacy-note')).toBeVisible();
    await expect(page.getByTestId('sample-json')).toBeVisible();
    await expect(page.getByTestId('sample-presets')).toBeVisible();
    await expect(page.getByTestId('chaos-slider')).toBeVisible();
    await expect(page.getByTestId('record-cta')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Got a real API\?/i })).toBeVisible();
  });

  test('auto-generates default Users preset above the fold', async ({ page }) => {
    await expect(page.getByTestId('results-section')).toBeVisible();
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('generated-output')).toContainText('"email"');
    await expect(page.getByTestId('context-input')).toHaveValue(/swedish users/i);
    const box = await page.getByTestId('generated-output').boundingBox();
    expect(box).toBeTruthy();
    // Above the fold on a typical laptop viewport (Playwright default ~720–900 tall)
    expect(box!.y).toBeLessThan(900);
  });

  for (const preset of ['users', 'orders', 'weather'] as const) {
    test(`preset ${preset} loads sample and generates`, async ({ page }) => {
      await page.getByTestId(`preset-${preset}`).click();
      await expect(page.getByTestId('results-section')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('generated-output')).not.toHaveText('[]');
      const context = await page.getByTestId('context-input').inputValue();
      expect(context.length).toBeGreaterThan(0);
    });
  }

  test('shows productName for items[*].name and structural array for $.items', async ({ page }) => {
    await page.getByTestId('preset-orders').click();
    await expect(page.getByTestId('field-kinds')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('structural-$.items')).toContainText(/array of objects/i);
    const nameKind = page.getByTestId('kind-$.items[*].name');
    await expect(nameKind).toBeVisible();
    await expect(nameKind).toContainText('productName');
  });

  test('generates records and variants at wild', async ({ page }) => {
    await page.getByTestId('chaos-slider').fill('2'); // wild
    await expect(page.getByTestId('chaos-level-label')).toHaveText('wild');

    await page.getByTestId('generate-button').click();
    await expect(page.getByTestId('results-section')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('generated-output')).toContainText('"email"');
    await expect(page.getByTestId('variant-list')).toBeVisible();
    await expect(page.getByTestId('resilience-checklist')).toBeVisible();
  });

  test('downloads generated JSON', async ({ page }) => {
    await expect(page.getByTestId('download-json')).toBeEnabled({ timeout: 30_000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-json').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('mockifyer-generated.json');

    const target = path.join(test.info().outputDir, download.suggestedFilename());
    await download.saveAs(target);
    const text = fs.readFileSync(target, 'utf8');
    const parsed = JSON.parse(text) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  test('URL hash round-trips share state', async ({ page }) => {
    await page.getByTestId('seed-input').fill('99');
    await page.getByTestId('count-input').fill('2');
    await page.getByTestId('chaos-slider').fill('2');
    await page.getByTestId('generate-button').click();
    await expect(page.getByTestId('resilience-checklist')).toBeVisible({ timeout: 30_000 });

    const firstVariant = page.locator('[data-testid^="checklist-"]').first();
    await firstVariant.check();

    await expect.poll(() => page.url()).toMatch(/#mdg1\./);

    const sharedUrl = page.url();
    await page.goto(sharedUrl);
    await expect(page.getByTestId('seed-input')).toHaveValue('99');
    await expect(page.getByTestId('count-input')).toHaveValue('2');
    await expect(page.getByTestId('chaos-level-label')).toHaveText('wild');
    await expect(firstVariant).toBeChecked();
  });

  test('share link copy and ZIP download work in Chromium', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await expect(page.getByTestId('download-variants-zip')).toBeVisible({ timeout: 30_000 });

    await expect.poll(() => page.url()).toMatch(/#mdg1\./);
    await page.getByTestId('copy-share-link').click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/#mdg1\./);
    expect(clipboard).toContain('/tools/mock-data-generator');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-variants-zip').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('mockifyer-variants.zip');
    const target = path.join(test.info().outputDir, download.suggestedFilename());
    await download.saveAs(target);
    const bytes = fs.readFileSync(target);
    expect(bytes.length).toBeGreaterThan(100);
    // ZIP local file header magic
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  test('is light-mode only (no dark class on document)', async ({ page }) => {
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDark).toBe(false);
  });
});

test.describe('Start page mock-data teaser', () => {
  test('shows live output with presets and links to the full generator', async ({ page }) => {
    await page.goto('/');
    const teaser = page.getByTestId('start-page-mock-generator');
    await expect(teaser).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('start-presets')).toBeVisible();
    await expect(page.getByTestId('start-generated-output')).toBeVisible();
    await expect(page.getByTestId('start-generated-output')).toContainText('"email"', {
      timeout: 30_000,
    });

    await page.getByTestId('start-preset-orders').click();
    await expect(page.getByTestId('start-context')).toHaveValue(/prices in USD/i);
    await expect(page.getByTestId('start-generated-output')).toContainText('"total"', {
      timeout: 30_000,
    });

    const href = await page.getByTestId('start-open-full-generator').getAttribute('href');
    expect(href).toMatch(/^\/tools\/mock-data-generator#mdg1\./);

    await page.getByTestId('start-open-full-generator').click();
    await expect(page).toHaveURL(/\/tools\/mock-data-generator#mdg1\./);
    await expect(page.getByTestId('context-input')).toHaveValue(/prices in USD/i);
  });
});
