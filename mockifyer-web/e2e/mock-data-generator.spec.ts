import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Mock Data Generator playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tools/mock-data-generator');
  });

  test('renders controls and side-by-side JSON + types above the fold on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('mock-data-generator-page')).toBeVisible();
    await expect(page.getByTestId('playground-intro')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Free Mock Data Generator/i })).toBeVisible();
    await expect(page.getByTestId('privacy-note')).toContainText(/Nothing leaves your browser/i);
    await expect(page.getByTestId('input-mode-switch')).toBeVisible();
    await expect(page.getByTestId('simple-controls')).toBeVisible();
    await expect(page.getByTestId('simple-type-select')).toBeVisible();
    await expect(page.getByTestId('simple-object-count')).toBeVisible();
    await expect(page.getByTestId('generate-button')).toBeVisible();
    await expect(page.getByTestId('tool-card')).toBeVisible();
    await expect(page.getByTestId('customize-row')).toBeVisible();
    await expect(page.getByTestId('locale-select')).toBeVisible();
    await expect(page.getByTestId('item-count-input')).toBeVisible();
    await expect(page.getByTestId('seed-input')).toBeVisible();
    await expect(page.getByTestId('more-section')).toBeVisible();

    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('generated-output')).toContainText('"email"');
    await expect(page.getByTestId('generated-types')).toBeVisible();
    await expect(page.getByTestId('generated-types')).toContainText(/export interface|interface /i);
    await expect(page.getByTestId('tool-output-split')).toBeVisible();

    const jsonBox = await page.getByTestId('generated-output').boundingBox();
    const typesBox = await page.getByTestId('generated-types').boundingBox();
    expect(jsonBox).toBeTruthy();
    expect(typesBox).toBeTruthy();
    expect(jsonBox!.y).toBeLessThan(900);
    expect(typesBox!.y).toBeLessThan(900);
  });

  test('object count control regenerates output', async ({ page }) => {
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('simple-count-10').click();
    await expect(page.getByTestId('generated-output')).toContainText('"email"', {
      timeout: 30_000,
    });
    const text = await page.getByTestId('generated-output').innerText();
    const usersMatch = text.match(/"users"\s*:\s*\[/);
    expect(usersMatch).toBeTruthy();
    const userIds = text.match(/"id"\s*:/g) ?? [];
    expect(userIds.length).toBeGreaterThanOrEqual(10);
  });

  test('Generate refreshes values and shows output status', async ({ page }) => {
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    const before = await page.getByTestId('generated-output').innerText();
    await page.getByTestId('generate-button').click();
    await expect
      .poll(async () => page.getByTestId('generated-output').innerText(), { timeout: 30_000 })
      .not.toBe(before);
    await expect(page.getByTestId('output-status')).toContainText(/Updated/i);
  });

  test('status and JSON reflect count 10, custom seed, and Spanish locale', async ({ page }) => {
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('simple-count-10').click();
    await expect(page.getByTestId('output-status')).toContainText(/Updated · 10 users/i, {
      timeout: 30_000,
    });

    await page.getByTestId('seed-input').fill('428429138');
    await page.getByTestId('seed-input').blur();
    await expect(page.getByTestId('output-status')).toContainText(/seed 428429138/i, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('output-status')).toContainText(/10 users/i);

    const beforeLocale = await page.getByTestId('generated-output').innerText();
    await page.getByTestId('locale-select').click();
    await page.getByTestId('locale-es').click();
    await expect(page.getByTestId('tool-error-banner')).toHaveCount(0);
    await expect
      .poll(async () => page.getByTestId('generated-output').innerText(), { timeout: 30_000 })
      .not.toBe(beforeLocale);
    await expect(page.getByTestId('output-status')).toContainText(/Updated · 10 users/i, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('output-status')).toContainText(/seed 428429138/i);

    const text = await page.getByTestId('generated-output').innerText();
    const userIds = text.match(/"id"\s*:/g) ?? [];
    expect(userIds.length).toBeGreaterThanOrEqual(10);
  });

  test('every playground locale loads without pane errors', async ({ page }) => {
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    const locales = ['en', 'sv', 'de', 'fr', 'es'] as const;
    for (const id of locales) {
      await page.getByTestId('locale-select').click();
      await page.getByTestId(`locale-${id}`).click();
      await expect(page.getByTestId('generated-output')).toContainText('"email"', {
        timeout: 30_000,
      });
      await expect(page.getByTestId('tool-error-banner')).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.locator('text=Failed to fetch dynamically imported module')).toHaveCount(0);
    }
  });

  test('Cards view shows themed cards and updates on Generate', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('tool-surface-cards').click();
    await expect(page.getByTestId('tool-cards-grid')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('tool-copy-cards-html')).toBeVisible();
    await expect(page.getByTestId('tool-copy-cards-react')).toBeVisible();
    await expect(page.getByTestId('tool-download-cards-png')).toBeVisible();
    const before = await page.getByTestId('tool-cards-grid').innerText();
    await page.getByTestId('generate-button').click();
    await expect(page.getByTestId('output-status')).toContainText(/Updated/i, { timeout: 30_000 });
    await expect
      .poll(async () => page.getByTestId('tool-cards-grid').innerText(), { timeout: 30_000 })
      .not.toBe(before);
  });

  test('simple type switch loads a different shape', async ({ page }) => {
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('simple-type-select').click();
    await page.getByTestId('simple-type-orders').click();
    await expect(page.getByTestId('generated-output')).toContainText('"total"', {
      timeout: 30_000,
    });
  });

  test('Use my own JSON mode shows sample beside output', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('mode-custom').click();
    await expect(page.getByTestId('custom-workspace')).toBeVisible();
    await expect(page.getByTestId('sample-json')).toBeVisible();
    await expect(page.getByTestId('upload-json-button')).toBeVisible();
    await expect(page.getByTestId('generate-button')).toBeVisible();
    await expect(page.getByTestId('custom-output-pane')).toBeVisible();
    await expect(page.getByTestId('fetch-url-input')).toHaveCount(0);
    const inputBox = await page.getByTestId('custom-json-section').boundingBox();
    const outputBox = await page.getByTestId('custom-output-pane').boundingBox();
    expect(inputBox).toBeTruthy();
    expect(outputBox).toBeTruthy();
    expect(Math.abs(inputBox!.y - outputBox!.y)).toBeLessThan(80);
  });

  test('Generate more like this scrolls to custom workspace with status', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('more-section').locator('summary').click();
    await expect(page.getByTestId('real-api-section')).toBeVisible();
    await page.getByTestId('real-api-use-sample').click();
    await expect(page.getByTestId('mode-custom')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('custom-workspace')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('output-status')).toContainText(/from your sample/i, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('generated-output')).toBeVisible();
  });

  test('More section reveals share, ZIP, real API, and record CTA', async ({ page }) => {
    const more = page.getByTestId('more-section');
    await more.locator('summary').click();
    await expect(page.getByTestId('copy-share-link')).toBeVisible();
    await expect(page.getByTestId('download-variants-zip')).toBeVisible();
    await expect(page.getByTestId('real-api-section')).toBeVisible();
    await expect(page.getByTestId('record-cta')).toBeVisible();
  });

  test('real API section shows recorded vs generated side by side', async ({ page }) => {
    await page.getByTestId('more-section').locator('summary').click();
    const section = page.getByTestId('real-api-section');
    await expect(section).toBeVisible();
    await expect(page.getByTestId('real-api-recorded')).toContainText('Leanne Graham');
    const generated = page.getByTestId('real-api-generated');
    await expect(generated).toContainText('"email"', { timeout: 30_000 });
    const preview = await generated.locator('pre').innerText();
    expect(preview.trimStart().startsWith('{')).toBe(true);
    expect(preview).toContain('"zipcode"');
    await expect(section.getByText(/nothing is sent to Mockifyer/i)).toBeVisible();
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
    const parsed = JSON.parse(text) as unknown;
    expect(parsed).toBeTruthy();
  });

  test('URL hash round-trips share state', async ({ page }) => {
    await page.getByTestId('seed-input').fill('99');
    await page.getByTestId('item-count-input').fill('2');
    await expect(page.getByTestId('generated-output')).toContainText('"email"', {
      timeout: 30_000,
    });
    await expect.poll(() => page.url()).toMatch(/#mdg1\./);

    const sharedUrl = page.url();
    await page.goto(sharedUrl);
    await expect(page.getByTestId('seed-input')).toHaveValue('99');
    await expect(page.getByTestId('item-count-input')).toHaveValue('2');
  });

  test('share link copy and ZIP download work in Chromium', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.url()).toMatch(/#mdg1\./);
    await page.getByTestId('more-section').locator('summary').click();
    await expect(page.getByTestId('download-variants-zip')).toBeVisible({ timeout: 30_000 });
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
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  test('is light-mode only (no dark class on document)', async ({ page }) => {
    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(hasDark).toBe(false);
  });

  test('Types language select emits Go and SEO section stays below the tool', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('generated-types')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('tool-types-language-select')).toBeVisible();
    await expect(page.getByTestId('generated-types')).toContainText(/export interface/i);

    await page.getByTestId('tool-types-language-select').click();
    await page.getByTestId('tool-types-lang-go').click();
    await expect(page.getByTestId('generated-types')).toContainText(/type \w+ struct/i);

    const seo = page.getByTestId('generator-seo-section');
    await expect(seo).toBeVisible();
    await expect(seo.getByRole('heading', { name: 'What is a mock data generator?' })).toBeVisible();
    await expect(
      seo.getByRole('heading', { name: 'Generate fake JSON for API testing' })
    ).toBeVisible();
    await expect(seo.getByRole('heading', { name: 'Generate types from JSON' })).toBeVisible();
    await expect(
      seo.getByRole('heading', { name: 'From generated data to recorded mocks with Mockifyer' })
    ).toBeVisible();
    await expect(page.getByTestId('generator-faq')).toBeVisible();

    const toolBox = await page.getByTestId('results-section').boundingBox();
    const seoBox = await seo.boundingBox();
    expect(toolBox).toBeTruthy();
    expect(seoBox).toBeTruthy();
    expect(seoBox!.y).toBeGreaterThan(toolBox!.y);
  });
});

test.describe('Mock Data Generator mobile', () => {
  for (const width of [360, 390, 430] as const) {
    test(`no horizontal overflow at ${width}px; JSON|Types tabs`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tools/mock-data-generator');
      await expect(page.getByTestId('mock-data-generator-page')).toBeVisible();
      await expect(page.getByTestId('simple-controls')).toBeVisible();
      await expect(page.getByTestId('generate-button')).toBeVisible();
      await expect(page.getByTestId('tool-output-tabs')).toBeVisible();
      await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('tool-tab-types').click();
      await expect(page.getByTestId('generated-types')).toBeVisible();
      await expect(page.getByTestId('generated-types')).toContainText(/export interface|interface /i);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
});

test.describe('Start page mock-data teaser', () => {
  test('simple teaser after Atlas: type, count, Generate, JSON/Types', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const teaser = page.getByTestId('start-page-mock-generator');
    await expect(teaser).toBeVisible({ timeout: 15_000 });

    const atlasBox = await page.locator('#atlas-showcase').boundingBox();
    const teaserBox = await teaser.boundingBox();
    expect(atlasBox).toBeTruthy();
    expect(teaserBox).toBeTruthy();
    expect(teaserBox!.y).toBeGreaterThan(atlasBox!.y);

    await expect(page.getByTestId('start-type-select')).toBeVisible();
    await expect(page.getByTestId('start-object-count')).toBeVisible();
    await expect(page.getByTestId('start-generate')).toBeVisible();
    await expect(page.getByTestId('start-tool-card')).toBeVisible();
    await expect(page.getByTestId('start-copy-json')).toBeVisible();
    await expect(page.getByTestId('start-output-split')).toBeVisible();
    await expect(page.getByTestId('start-context')).toHaveCount(0);

    await expect(page.getByTestId('start-generated-preview')).toContainText('"email"', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('start-generated-types')).toBeVisible();
    await expect(page.getByTestId('start-generated-types')).toContainText(/export interface|interface /i);

    const before = await page.getByTestId('start-generated-preview').innerText();
    await page.getByTestId('start-generate').click();
    await expect
      .poll(async () => page.getByTestId('start-generated-preview').innerText(), {
        timeout: 30_000,
      })
      .not.toBe(before);
    await expect(page.getByTestId('start-output-status')).toContainText(/Updated/i);

    await page.getByTestId('start-count-10').click();
    await expect
      .poll(async () => {
        const text = await page.getByTestId('start-generated-preview').innerText();
        return (text.match(/"id"\s*:/g) ?? []).length;
      }, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(10);

    await page.getByTestId('start-copy-json').click();
    await expect(page.getByTestId('start-copy-json')).toContainText(/Copied/i);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('"email"');

    await page.getByTestId('start-type-select').click();
    await page.getByTestId('start-type-orders').click();
    await expect(page.getByTestId('start-generated-preview')).toContainText('"total"', {
      timeout: 30_000,
    });

    const href = await page.getByTestId('start-open-full-generator').getAttribute('href');
    expect(href).toMatch(/^\/tools\/mock-data-generator#mdg1\./);

    await page.getByTestId('start-open-full-generator').click();
    await expect(page).toHaveURL(/\/tools\/mock-data-generator#mdg1\./);
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('generated-types')).toBeVisible();
  });

  test('Tools nav links to the mock data generator', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByTestId('nav-tools-trigger').click();
    const link = page.getByTestId('nav-mock-data-generator');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/tools\/mock-data-generator/);
  });
});
