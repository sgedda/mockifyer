import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Mock Data Generator playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tools/mock-data-generator');
  });

  test('renders the playground page', async ({ page }) => {
    await expect(page.getByTestId('mock-data-generator-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Mock data generator/i })).toBeVisible();
    await expect(page.getByText(/Nothing leaves your browser/i)).toBeVisible();
    await expect(page.getByTestId('sample-json')).toBeVisible();
    await expect(page.getByTestId('chaos-slider')).toBeVisible();
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
    await page.getByTestId('generate-button').click();
    await expect(page.getByTestId('download-json')).toBeVisible({ timeout: 30_000 });

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

  test('is light-mode only (no dark class on document)', async ({ page }) => {
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDark).toBe(false);
  });
});
