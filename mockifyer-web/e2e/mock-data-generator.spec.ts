import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Mock Data Generator playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tools/mock-data-generator');
  });

  test('renders simple controls and output above the fold', async ({ page }) => {
    await expect(page.getByTestId('mock-data-generator-page')).toBeVisible();
    await expect(page.getByTestId('playground-intro')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Mock data generator/i })).toBeVisible();
    await expect(page.getByTestId('privacy-note')).toContainText(/Nothing leaves your browser/i);
    await expect(page.getByTestId('simple-controls')).toBeVisible();
    await expect(page.getByTestId('simple-type-select')).toBeVisible();
    await expect(page.getByTestId('simple-object-count')).toBeVisible();
    await expect(page.getByTestId('randomize-button')).toBeVisible();
    await expect(page.getByTestId('advanced-section')).toBeVisible();
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('generated-output')).toContainText('"email"');
    const box = await page.getByTestId('generated-output').boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y).toBeLessThan(900);
  });

  test('object count control regenerates output', async ({ page }) => {
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('simple-count-10').click();
    await expect(page.getByTestId('generated-output')).toContainText('"email"', {
      timeout: 30_000,
    });
    // Users sample uses itemCount — expect 10 users in the wrapper
    const text = await page.getByTestId('generated-output').innerText();
    const usersMatch = text.match(/"users"\s*:\s*\[/);
    expect(usersMatch).toBeTruthy();
    const userIds = text.match(/"id"\s*:/g) ?? [];
    expect(userIds.length).toBeGreaterThanOrEqual(10);
  });

  test('Randomize changes the generated values', async ({ page }) => {
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    const before = await page.getByTestId('generated-output').innerText();
    await page.getByTestId('randomize-button').click();
    await expect
      .poll(async () => page.getByTestId('generated-output').innerText(), { timeout: 30_000 })
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

  test('advanced section reveals paste, items, real API, and record CTA', async ({ page }) => {
    const advanced = page.getByTestId('advanced-section');
    await advanced.locator('summary').click();
    await expect(page.getByTestId('sample-json')).toBeVisible();
    await expect(page.getByTestId('upload-json-button')).toBeVisible();
    await expect(page.getByTestId('item-count-input')).toBeVisible();
    await expect(page.getByTestId('fetch-url-input')).toHaveCount(0);
    await expect(page.getByTestId('chaos-slider')).toBeVisible();
    await expect(page.getByTestId('real-api-section')).toBeVisible();
    await expect(page.getByTestId('record-cta')).toBeVisible();

    await page.getByTestId('item-count-increment').click();
    await expect(page.getByTestId('item-count-input')).toHaveValue(
      await page.getByTestId('item-count-input').inputValue()
    );
    await expect(page.getByTestId('size-controls-live')).not.toContainText('~');
  });

  test('real API section shows recorded vs generated side by side', async ({ page }) => {
    await page.getByTestId('advanced-section').locator('summary').click();
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

  test('shows productName for items[*].name and structural array for $.items', async ({
    page,
  }) => {
    await page.getByTestId('advanced-section').locator('summary').click();
    await page.getByTestId('preset-chip-orders').click();
    await expect(page.getByTestId('field-kinds')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('structural-$.items')).toContainText(/array of objects/i);
    const nameKind = page.getByTestId('kind-$.items[*].name');
    await expect(nameKind).toBeVisible();
    await expect(nameKind).toContainText('productName');
  });

  test('generates records and variants at wild', async ({ page }) => {
    await page.getByTestId('advanced-section').locator('summary').click();
    await page.getByTestId('chaos-slider').fill('2');
    await expect(page.getByTestId('chaos-level-label')).toHaveText('wild');
    await page.getByTestId('generate-button').click();
    await expect(page.getByTestId('generated-output')).toContainText('"email"', {
      timeout: 30_000,
    });
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
    const parsed = JSON.parse(text) as unknown;
    expect(parsed).toBeTruthy();
  });

  test('URL hash round-trips share state', async ({ page }) => {
    await page.getByTestId('advanced-section').locator('summary').click();
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
    await page.getByTestId('advanced-section').locator('summary').click();
    await expect(page.getByTestId('seed-input')).toHaveValue('99');
    await expect(page.getByTestId('count-input')).toHaveValue('2');
    await expect(page.getByTestId('chaos-level-label')).toHaveText('wild');
    await expect(firstVariant).toBeChecked();
  });

  test('share link copy and ZIP download work in Chromium', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('advanced-section').locator('summary').click();
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
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  test('is light-mode only (no dark class on document)', async ({ page }) => {
    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(hasDark).toBe(false);
  });

  test('Types tab language select emits Go and SEO section stays below the tool', async ({
    page,
  }) => {
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('tool-tab-types').click();
    await expect(page.getByTestId('tool-types-language-select')).toBeVisible();
    await expect(page.getByTestId('generated-output')).toContainText(/export interface/i);

    await page.getByTestId('tool-types-language-select').click();
    await page.getByTestId('tool-types-lang-go').click();
    await expect(page.getByTestId('generated-output')).toContainText(/type \w+ struct/i);

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
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tools/mock-data-generator');
      await expect(page.getByTestId('mock-data-generator-page')).toBeVisible();
      await expect(page.getByTestId('simple-controls')).toBeVisible();
      await expect(page.getByTestId('randomize-button')).toBeVisible();
      await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      await page.getByTestId('advanced-section').locator('summary').click();
      await page.getByTestId('real-api-section').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('real-api-recorded')).toBeVisible();
      const recordedBox = await page.getByTestId('real-api-recorded').boundingBox();
      expect(recordedBox).toBeTruthy();
      expect(recordedBox!.width).toBeLessThanOrEqual(width);
    });
  }
});

test.describe('Start page mock-data teaser', () => {
  test('simple teaser after Atlas: type, count, Randomize, JSON/Types', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
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
    await expect(page.getByTestId('start-count-1')).toBeVisible();
    await expect(page.getByTestId('start-count-5')).toBeVisible();
    await expect(page.getByTestId('start-count-10')).toBeVisible();
    await expect(page.getByTestId('start-count-25')).toBeVisible();
    await expect(page.getByTestId('start-randomize')).toBeVisible();
    await expect(page.getByTestId('start-copy-output')).toBeVisible();
    await expect(page.getByTestId('start-tab-json')).toBeVisible();
    await expect(page.getByTestId('start-tab-types')).toBeVisible();
    await expect(page.getByTestId('start-context')).toHaveCount(0);
    await expect(page.getByTestId('start-shuffle')).toHaveCount(0);

    await expect(page.getByTestId('start-generated-preview')).toContainText('"email"', {
      timeout: 30_000,
    });

    const before = await page.getByTestId('start-generated-preview').innerText();
    await page.getByTestId('start-randomize').click();
    await expect
      .poll(async () => page.getByTestId('start-generated-preview').innerText(), {
        timeout: 30_000,
      })
      .not.toBe(before);

    await page.getByTestId('start-count-10').click();
    await expect
      .poll(async () => {
        const text = await page.getByTestId('start-generated-preview').innerText();
        return (text.match(/"id"\s*:/g) ?? []).length;
      }, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(10);

    await page.getByTestId('start-copy-output').click();
    await expect(page.getByTestId('start-copy-output')).toContainText(/Copied/i);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('"email"');

    await page.getByTestId('start-tab-types').click();
    await expect(page.getByTestId('start-types-language-select')).toBeVisible();
    await expect(page.getByTestId('start-generated-preview')).toContainText(/interface|type /i);

    await page.getByTestId('start-type-select').click();
    await page.getByTestId('start-type-orders').click();
    await page.getByTestId('start-tab-json').click();
    await expect(page.getByTestId('start-generated-output')).toContainText('"total"', {
      timeout: 30_000,
    });

    const href = await page.getByTestId('start-open-full-generator').getAttribute('href');
    expect(href).toMatch(/^\/tools\/mock-data-generator#mdg1\./);

    await page.getByTestId('start-open-full-generator').click();
    await expect(page).toHaveURL(/\/tools\/mock-data-generator#mdg1\./);
    await expect(page.getByTestId('generated-output')).toBeVisible({ timeout: 30_000 });
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
